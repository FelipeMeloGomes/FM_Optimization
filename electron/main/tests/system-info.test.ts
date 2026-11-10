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

// Simula uma máquina sem `os.cpus()` para que a única fonte restante seja o
// systeminformation — é o caminho que valida o mapeamento de `brand` e
// `physicalCores` feito em cpu-vendor.ts.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, cpus: () => [], arch: () => 'x64' };
});

import { resetCpuVendorCache } from '../services/cpu-vendor';
import { execPowerShell } from '../services/powershell';
import { getCpuInfo, getGpuInfo } from '../services/system-info';

const execMock = vi.mocked(execPowerShell);

type Handler = [matcher: string, output: string];

function mockPowerShell(handlers: Handler[]): void {
  execMock.mockImplementation(async (script: string) => {
    for (const [matcher, output] of handlers) {
      if (script.includes(matcher)) return output;
    }
    return '';
  });
}

function calledScripts(): string[] {
  return execMock.mock.calls.map(([script]) => script);
}

beforeEach(() => {
  execMock.mockReset();
  resetCpuVendorCache();
});

/**
 * Estes testes cobrem a fiação de `getCpuInfo`/`getGpuInfo`, não só as funções
 * puras: garantem que o WMI alimenta `buildCpuInfo`, que o nome da GPU passa
 * pelo formatador e que a query pede todos os campos que o parser lê. Sem eles,
 * remover `formatGpuName` ou apagar `Name` da query deixaria a suíte verde.
 */
describe('getCpuInfo', () => {
  const wmi = {
    Name: 'AMD Ryzen 5 5500 6-Core Processor',
    Manufacturer: 'AuthenticAMD',
    Description: 'AMD64 Family 25 Model 80 Stepping 0',
    NumberOfCores: 6,
    NumberOfLogicalProcessors: 12,
    MaxClockSpeed: 3600,
  };

  it('usa o WMI como fonte e entrega o nome já normalizado', async () => {
    mockPowerShell([
      ['Win32_Processor', JSON.stringify(wmi)],
      ['Get-Counter', '7'],
    ]);

    const info = await getCpuInfo();

    expect(info.model).toBe('AMD Ryzen 5 5500');
    expect(info.rawModel).toBe('AMD Ryzen 5 5500 6-Core Processor');
    expect(info.vendor).toBe('amd');
    expect(info.cores).toBe(6);
    expect(info.logicalProcessors).toBe(12);
    expect(info.maxClockMhz).toBe(3600);
    expect(info.family).toBe('25');
    expect(info.modelNumber).toBe('80');
    expect(info.stepping).toBe('0');
    expect(info.nameSource).toBe('wmi');
    expect(info.nameIsGeneric).toBe(false);
    expect(info.coresEstimated).toBe(false);
    expect(info.usage).toBe(7);
  });

  it('pede ao WMI todos os campos que o parser lê', async () => {
    mockPowerShell([['Win32_Processor', JSON.stringify(wmi)]]);

    await getCpuInfo();

    const query = calledScripts().find((script) => script.includes('Win32_Processor'));
    expect(query).toBeDefined();
    for (const field of [
      'Name',
      'Manufacturer',
      'Description',
      'NumberOfCores',
      'NumberOfLogicalProcessors',
      'MaxClockSpeed',
    ]) {
      expect(query).toContain(field);
    }
  });

  it('cai para o systeminformation quando WMI e os.cpus não trazem nada', async () => {
    mockPowerShell([]);

    const info = await getCpuInfo();

    // O brand do systeminformation vem sem fabricante; buildCpuInfo prefixa
    // `identity.manufacturer` antes de formatar.
    expect(info.model).toBe('AMD Ryzen 5 5500');
    expect(info.vendor).toBe('amd');
    expect(info.cores).toBe(6);
    expect(info.coresEstimated).toBe(false);
    expect(info.nameSource).toBe('systeminformation');
  });
});

describe('getGpuInfo', () => {
  it('formata o nome da GPU e preserva o original', async () => {
    mockPowerShell([
      [
        'Win32_VideoController | Select-Object',
        JSON.stringify([
          { Name: 'AMD Radeon(TM) Graphics', DriverVersion: '1.0', PNPDeviceID: 'PCI\\VEN_1002' },
          {
            Name: 'NVIDIA GeForce RTX 3060 Laptop GPU',
            DriverVersion: '560.70',
            PNPDeviceID: 'PCI\\VEN_10DE&DEV_2520',
          },
        ]),
      ],
      ['nvidia-smi --query-gpu=memory.total', '6144'],
      ['nvidia-smi --query-gpu=utilization.gpu', '42'],
    ]);

    const info = await getGpuInfo();

    expect(info.name).toBe('NVIDIA GeForce RTX 3060 Laptop');
    expect(info.rawName).toBe('NVIDIA GeForce RTX 3060 Laptop GPU');
    expect(info.driverVersion).toBe('560.70');
    expect(info.vram).toBe('6 GB');
    expect(info.usage).toBe(42);
  });

  it('usa o VRAM do registro e o contador do Windows quando não há nvidia-smi', async () => {
    mockPowerShell([
      [
        'Win32_VideoController | Select-Object',
        JSON.stringify([
          {
            Name: 'AMD Radeon RX 580 Series',
            DriverVersion: '31.0.12027.9001',
            PNPDeviceID: 'PCI\\VEN_1002&DEV_67DF&SUBSYS_0000',
          },
        ]),
      ],
      ['HardwareInformation', 'PCI\\VEN_1002&DEV_67DF|8589934592'],
      ['Get-Counter', '13'],
    ]);

    const info = await getGpuInfo();

    expect(info.name).toBe('AMD Radeon RX 580');
    expect(info.rawName).toBe('AMD Radeon RX 580 Series');
    expect(info.vram).toBe('8 GB');
    expect(info.usage).toBe(13);
  });

  it('cai para o AdapterRAM quando o registro não traz o tamanho', async () => {
    mockPowerShell([
      [
        'Win32_VideoController | Select-Object',
        JSON.stringify([
          {
            Name: 'Intel(R) UHD Graphics 630',
            DriverVersion: '27.20.100.9316',
            PNPDeviceID: 'PCI\\VEN_8086&DEV_3E9B',
          },
        ]),
      ],
      ['AdapterRAM', '4294967296'],
      ['Get-Counter', '3'],
    ]);

    const info = await getGpuInfo();

    expect(info.vram).toBe('4 GB');
    expect(info.usage).toBe(3);

    // O fallback só funciona se a consulta filtrar pelo adaptador escolhido.
    const adapterQuery = calledScripts().find((script) => script.includes('AdapterRAM'));
    expect(adapterQuery).toContain("PNPDeviceID='PCI\\VEN_8086&DEV_3E9B'");
  });

  it('pede ao WMI os campos usados para escolher e identificar a GPU', async () => {
    mockPowerShell([
      ['Win32_VideoController | Select-Object', JSON.stringify([{ Name: 'AMD Radeon RX 7600' }])],
    ]);

    await getGpuInfo();

    const query = calledScripts().find((script) =>
      script.includes('Win32_VideoController | Select-Object')
    );
    expect(query).toBeDefined();
    for (const field of ['Name', 'DriverVersion', 'PNPDeviceID']) {
      expect(query).toContain(field);
    }
  });

  it('devolve N/A quando o WMI não responde', async () => {
    mockPowerShell([]);

    await expect(getGpuInfo()).resolves.toMatchObject({
      name: 'N/A',
      vram: 'N/A',
      driverVersion: 'N/A',
      usage: 0,
    });
  });
});
