import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/powershell', () => ({ execPowerShell: vi.fn() }));

vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(async () => ({
      manufacturer: 'AMD',
      brand: 'Ryzen 5 5500 6-Core Processor',
      physicalCores: 6,
    })),
  },
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, cpus: () => [], arch: () => 'x64' };
});

import { execPowerShell } from '../services/powershell';
import { getCpuInfo } from '../services/system-info';

const execMock = vi.mocked(execPowerShell);

const wmi = {
  Name: 'AMD Ryzen 5 5500 6-Core Processor',
  Manufacturer: 'AuthenticAMD',
  Description: 'AMD64 Family 25 Model 80 Stepping 0',
  NumberOfCores: 6,
  NumberOfLogicalProcessors: 12,
  MaxClockSpeed: 3600,
};

// O script consolidado devolve cada seção já serializada como string dentro do
// JSON externo — é exatamente o formato produzido pelo PowerShell no Windows.
const consolidated = JSON.stringify({ cpu: JSON.stringify(wmi) });

beforeEach(() => {
  execMock.mockReset();
});

describe('getCpuInfo com a consulta WMI consolidada', () => {
  it('aproveita o CPU consolidado e preenche família, modelo, stepping e clock', async () => {
    execMock.mockImplementation(async (script: string) => {
      if (script.includes('@{ cpu=$cpu')) return consolidated;
      return '';
    });

    const info = await getCpuInfo();

    expect(info.nameSource).toBe('wmi');
    expect(info.model).toBe('AMD Ryzen 5 5500');
    expect(info.family).toBe('25');
    expect(info.modelNumber).toBe('80');
    expect(info.stepping).toBe('0');
    expect(info.maxClockMhz).toBe(3600);
  });
});
