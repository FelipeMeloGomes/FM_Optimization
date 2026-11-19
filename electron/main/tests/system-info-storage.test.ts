import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/powershell', () => ({ execPowerShell: vi.fn() }));

vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(async () => ({ manufacturer: 'AMD', brand: 'Ryzen', physicalCores: 8 })),
  },
}));

import { execPowerShell } from '../services/powershell';
import { getStorageDrives } from '../services/system-info';

const execMock = vi.mocked(execPowerShell);

// O WMI consolidado fica em cache por alguns segundos; avançar o relógio entre
// os testes evita que um caso reaproveite a resposta do anterior.
let clock = Date.now();
vi.spyOn(Date, 'now').mockImplementation(() => clock);

const LOGICAL_DISKS = [
  { DeviceID: 'C:', VolumeName: 'Sistema', Size: 1000, Free: 400, FileSystem: 'NTFS' },
  { DeviceID: 'D:', VolumeName: 'Dados', Size: 500, Free: 200, FileSystem: 'NTFS' },
  { DeviceID: 'E:', VolumeName: 'Backup', Size: 2000, Free: 500, FileSystem: 'NTFS' },
  { DeviceID: 'F:', VolumeName: 'Outros', Size: 250, Free: 100, FileSystem: 'exFAT' },
  { DeviceID: 'G:', VolumeName: 'Extra', Size: 120, Free: 60, FileSystem: 'FAT32' },
];

const DISK_MAP = [
  { DriveLetter: 'C', MediaType: 'SSD', BusType: 'NVMe' },
  { DriveLetter: 'D', MediaType: 'SSD', BusType: 'SATA' },
  { DriveLetter: 'E', MediaType: 'HDD', BusType: 'SATA' },
  { DriveLetter: 'F', MediaType: null, BusType: 'NVMe' },
];

/**
 * O Dashboard mostra a identidade da unidade (SSD NVMe, SSD, HD). O tipo vem
 * da consulta consolidada: Win32_LogicalDisk só entrega o sistema de arquivos,
 * então é preciso cruzar a letra da unidade com a mídia e o barramento do disco.
 */
beforeEach(() => {
  clock += 10_000;
  execMock.mockReset();
  execMock.mockImplementation(async (script: string) => {
    if (script.includes('Get-Partition')) {
      // Cada seção da consulta consolidada já chega como string JSON.
      return JSON.stringify({ diskMap: JSON.stringify(DISK_MAP) });
    }
    if (script.includes('Win32_LogicalDisk')) return JSON.stringify(LOGICAL_DISKS);
    return '';
  });
});

describe('getStorageDrives', () => {
  it('identifica SSD NVMe, SSD e HD e mantém o sistema de arquivos', async () => {
    const drives = await getStorageDrives();

    expect(drives.map((drive) => drive.type)).toEqual([
      'SSD NVMe',
      'SSD',
      'HD',
      'SSD NVMe',
      'FAT32',
    ]);
    expect(drives.map((drive) => drive.fileSystem)).toEqual([
      'NTFS',
      'NTFS',
      'NTFS',
      'exFAT',
      'FAT32',
    ]);
  });

  it('reconhece NVMe pelo barramento quando o MediaType vem vazio', async () => {
    const drives = await getStorageDrives();

    expect(drives[3].type).toBe('SSD NVMe');
  });

  it('mantém os dados de tamanho e uso da unidade', async () => {
    const drives = await getStorageDrives();

    expect(drives[0]).toMatchObject({
      letter: 'C:',
      label: 'Sistema',
      size: '1000 GB',
      free: '400 GB',
      usedPercent: 60,
    });
  });

  it('pede ao WMI a mídia e o barramento de cada partição', async () => {
    await getStorageDrives();

    const query = execMock.mock.calls[0][0];
    expect(query).toContain('Get-Partition');
    expect(query).toContain('MediaType');
    expect(query).toContain('BusType');
    expect(query).toContain('Get-PhysicalDisk | Select-Object DeviceId,MediaType,BusType');
    expect(query).not.toContain('Get-PhysicalDisk -Property');
  });
});
