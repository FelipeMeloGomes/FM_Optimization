import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/powershell', () => ({ execPowerShell: vi.fn() }));

vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(async () => ({ manufacturer: 'AMD', brand: 'Ryzen', physicalCores: 8 })),
  },
}));

import { execPowerShell } from '../services/powershell';
import { getSystemInfo } from '../services/system-info';

const execMock = vi.mocked(execPowerShell);

let clock = Date.now();
vi.spyOn(Date, 'now').mockImplementation(() => clock);

/**
 * A página "Meu PC" mostra placa-mãe e caches lidos direto do Windows.
 * Esses dados não existiam no DashboardData e vêm da consulta consolidada.
 */
beforeEach(() => {
  clock += 10_000;
  execMock.mockReset();
  execMock.mockImplementation(async (script: string) => {
    if (script.includes('$ProgressPreference')) {
      return JSON.stringify({
        cpu: JSON.stringify({ Name: 'AMD Ryzen 7 9800X3D' }),
        caches: JSON.stringify([
          { Level: 3, MaxCacheSize: 640 },
          { Level: 4, MaxCacheSize: 8192 },
          { Level: 5, MaxCacheSize: 32768 },
        ]),
        motherboard: JSON.stringify({
          Manufacturer: 'Gigabyte Technology Co., Ltd.',
          Product: 'X870 AORUS ELITE WIFI7',
          Version: '1.0',
        }),
        bios: JSON.stringify({ Version: '5.17', ReleaseDate: '02/01/2023' }),
        memorySlots: '4',
        memoryUsed: '2',
        os: JSON.stringify({
          Caption: 'Microsoft Windows 11 Pro',
          Version: '10.0.26100',
          BuildNumber: '26100',
          InstallDate: '/Date(1735689600000)/',
        }),
      });
    }
    if (script.includes('Win32_OperatingSystem')) {
      return JSON.stringify({
        Caption: 'Microsoft Windows 11 Pro',
        Version: '10.0.26100',
        BuildNumber: '26100',
        InstallDate: '/Date(1735689600000)/',
      });
    }
    if (script.includes('Win32_BaseBoard')) {
      return JSON.stringify({
        Manufacturer: 'Gigabyte Technology Co., Ltd.',
        Product: 'X870 AORUS ELITE WIFI7',
        Version: '1.0',
      });
    }
    if (script.includes('Win32_Processor')) {
      return JSON.stringify({
        Name: 'AMD Ryzen 7 9800X3D',
        L1CacheSize: 640,
        L2CacheSize: 8192,
        L3CacheSize: 32768,
      });
    }
    if (script.includes('Win32_PhysicalMemoryArray')) return '4';
    return '{}';
  });
});

describe('getSystemInfo — hardware da página Meu PC', () => {
  it('lê fabricante e modelo da placa-mãe', async () => {
    const info = await getSystemInfo();

    expect(info.motherboard).toMatchObject({
      manufacturer: 'Gigabyte Technology Co., Ltd.',
      product: 'X870 AORUS ELITE WIFI7',
    });
  });

  it('lê versão e data da BIOS quando a versão da placa-mãe não existe', async () => {
    const info = await getSystemInfo();

    expect(info.motherboard?.biosVersion).toBe('5.17');
    expect(info.motherboard?.biosReleaseDate).toBe('02/01/2023');
  });

  it('busca a BIOS separadamente se ela não vier na consulta consolidada', async () => {
    execMock.mockImplementation(async (script: string) => {
      if (script.includes('$ProgressPreference')) {
        return JSON.stringify({
          motherboard: JSON.stringify({
            Manufacturer: 'Gigabyte Technology Co., Ltd.',
            Product: 'X870 AORUS ELITE WIFI7',
            Version: '1.0',
          }),
          memorySlots: '4',
        });
      }
      if (script.includes('Win32_BIOS')) {
        return JSON.stringify({ Version: '5.17', ReleaseDate: '02/01/2023' });
      }
      if (script.includes('Win32_BaseBoard')) {
        return JSON.stringify({
          Manufacturer: 'Gigabyte Technology Co., Ltd.',
          Product: 'X870 AORUS ELITE WIFI7',
          Version: '1.0',
        });
      }
      return '{}';
    });

    const info = await getSystemInfo();

    expect(info.motherboard?.biosVersion).toBe('5.17');
    expect(info.motherboard?.biosReleaseDate).toBe('02/01/2023');
  });

  it('lê os caches L1, L2 e L3 em KB', async () => {
    const info = await getSystemInfo();

    expect(info.caches).toEqual({ l1: '640 KB', l2: '8 MB', l3: '32 MB' });
  });

  it('conta os slots de memória usados e o total disponível', async () => {
    const info = await getSystemInfo();

    expect(info.memory.slotsUsed).toBeGreaterThan(0);
    expect(info.memory.slotsTotal).toBe(4);
  });

  it('extrai a edição do Windows do Caption em vez de repetir a versão', async () => {
    const info = await getSystemInfo();

    expect(info.os.name).toBe('Microsoft Windows 11 Pro');
    expect(info.os.version).toBe('10.0.26100');
    expect(info.os.build).toBe('26100');
    expect(info.os.edition).toBe('Pro');
  });

  it('pede placa-mãe, caches e slots na consulta consolidada', async () => {
    await getSystemInfo();

    const query = execMock.mock.calls[0][0];
    expect(query).toContain('Win32_BaseBoard');
    expect(query).toContain('Win32_CacheMemory');
    expect(query).toContain('MemoryDevices');
  });
});
