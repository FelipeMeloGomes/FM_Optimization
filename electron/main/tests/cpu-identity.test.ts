import { describe, expect, it } from 'vitest';
import {
  formatCpuName,
  isGenericCpuName,
  parseGenericCpuName,
  resolveCpuName,
  trimCpuName,
} from '../services/cpu-identity';
import { buildCpuInfo, parseWmiProcessor } from '../services/system-info';

/**
 * O nome da CPU é o único campo do Dashboard que vem de três fontes diferentes
 * (WMI, os.cpus e systeminformation) e ainda pode ser um identificador genérico
 * de BIOS. Estes testes fixam o padrão de exibição para que uma regra nova não
 * transforme "AMD Ryzen 5 5500" em "Family 25" nem apague o modelo.
 */
describe('formatCpuName', () => {
  const cases: Array<[string, string]> = [
    ['AMD Ryzen 7 5700X 8-Core Processor', 'AMD Ryzen 7 5700X'],
    ['AMD Ryzen 5 5500 6-Core Processor', 'AMD Ryzen 5 5500'],
    ['AMD Ryzen 5 5600G with Radeon Graphics', 'AMD Ryzen 5 5600G'],
    ['AMD Ryzen AI 9 HX 370 w/ Radeon 890M', 'AMD Ryzen AI 9 HX 370'],
    ['AMD Ryzen Threadripper PRO 7995WX 96-Core Processor', 'AMD Ryzen Threadripper PRO 7995WX'],
    ['AMD EPYC 7763 64-Core Processor', 'AMD EPYC 7763'],
    ['AMD FX-8350 Eight-Core Processor', 'AMD FX-8350'],
    ['AMD Athlon II X4 640 Processor', 'AMD Athlon II X4 640'],
    ['Intel(R) Core(TM) i7-10700K CPU @ 2.90GHz', 'Intel Core i7-10700K'],
    ['12th Gen Intel(R) Core(TM) i7-12700K', 'Intel Core i7-12700K'],
    ['Intel(R) Core(TM) Ultra 7 155H', 'Intel Core Ultra 7 155H'],
    ['Intel(R) Xeon(R) Gold 6248 CPU @ 2.50GHz', 'Intel Xeon Gold 6248'],
    ['Intel(R) Pentium(R) Gold G5400 CPU @ 3.70GHz', 'Intel Pentium Gold G5400'],
    ['Intel(R) Celeron(R) N4020 CPU @ 2.80GHz', 'Intel Celeron N4020'],
    ['Intel(R) Core(TM)2 Duo CPU E8400 @ 3.00GHz', 'Intel Core 2 Duo E8400'],
    ['Snapdragon(R) X Elite - X1E78100 - Qualcomm(R) Oryon(TM) CPU', 'Snapdragon X Elite X1E78100'],
    ['Virtual CPU @ 2.40GHz', 'CPU virtual'],
    ['AMD64 Family 25 Model 80 Stepping 0', 'AMD (Família 25 · Modelo 80)'],
    ['Intel64 Family 6 Model 165 Stepping 5', 'Intel (Família 6 · Modelo 165)'],
    ['ARM64 Family 8 Model 1 Stepping 0', 'ARM (Família 8 · Modelo 1)'],
  ];

  it.each(cases)('%s → %s', (raw, expected) => {
    expect(formatCpuName(raw)).toBe(expected);
  });

  it('é idempotente', () => {
    for (const [, expected] of cases) {
      expect(formatCpuName(expected)).toBe(expected);
    }
  });

  it('preserva o modelo e só remove os sufixos descritivos', () => {
    expect(formatCpuName('AMD Ryzen 7 5800X3D 8-Core Processor')).toBe('AMD Ryzen 7 5800X3D');
    expect(formatCpuName('AMD Ryzen 5 5500U with Radeon Graphics')).toBe('AMD Ryzen 5 5500U');
    expect(formatCpuName('Intel(R) Core(TM) i9-14900K')).toBe('Intel Core i9-14900K');
  });

  it('não deixa nome vazio', () => {
    expect(formatCpuName('')).toBe('Unknown');
    expect(formatCpuName('   ')).toBe('Unknown');
  });
});

describe('parseGenericCpuName', () => {
  it('extrai prefixo, família, modelo e stepping', () => {
    expect(parseGenericCpuName('AMD64 Family 25 Model 80 Stepping 0')).toEqual({
      prefix: 'AMD64',
      family: '25',
      modelNumber: '80',
      stepping: '0',
    });
  });

  it('reconhece identificadores Intel e ARM', () => {
    expect(parseGenericCpuName('Intel64 Family 6 Model 165 Stepping 5')?.prefix).toBe('Intel64');
    expect(parseGenericCpuName('ARM64 Family 8 Model 1 Stepping 0')?.prefix).toBe('ARM64');
  });

  it('rejeita nomes comerciais', () => {
    expect(parseGenericCpuName('AMD Ryzen 5 5500 6-Core Processor')).toBeNull();
  });
});

describe('isGenericCpuName', () => {
  it('detecta identificador de BIOS e placeholders', () => {
    expect(isGenericCpuName('AMD64 Family 25 Model 80 Stepping 0')).toBe(true);
    expect(isGenericCpuName('Unknown')).toBe(true);
    expect(isGenericCpuName('To Be Filled By O.E.M.')).toBe(true);
  });

  it('não trata nome comercial como genérico', () => {
    expect(isGenericCpuName('AMD Ryzen 5 5500')).toBe(false);
    expect(isGenericCpuName('Intel Core i7-10700K')).toBe(false);
  });
});

describe('trimCpuName', () => {
  it('remove o padding que o os.cpus() devolve no Windows', () => {
    expect(trimCpuName('AMD Ryzen 7 5700X 8-Core Processor             ')).toBe(
      'AMD Ryzen 7 5700X 8-Core Processor'
    );
  });
});

describe('resolveCpuName', () => {
  it('prefere o nome comercial do WMI ao genérico do os.cpus()', () => {
    expect(
      resolveCpuName({
        wmiName: 'AMD Ryzen 5 5500 6-Core Processor',
        osModel: 'AMD64 Family 25 Model 80 Stepping 0',
      })
    ).toMatchObject({
      name: 'AMD Ryzen 5 5500',
      raw: 'AMD Ryzen 5 5500 6-Core Processor',
      source: 'wmi',
      generic: false,
    });
  });

  it('usa o os.cpus() quando o WMI só tem o identificador genérico', () => {
    expect(
      resolveCpuName({
        wmiName: 'AMD64 Family 25 Model 80 Stepping 0',
        osModel: 'AMD Ryzen 5 5500 6-Core Processor',
      })
    ).toMatchObject({
      name: 'AMD Ryzen 5 5500',
      source: 'os',
      generic: false,
    });
  });

  it('usa o systeminformation como última fonte', () => {
    expect(resolveCpuName({ siBrand: 'AMD Ryzen 5 5500 6-Core Processor' })).toMatchObject({
      name: 'AMD Ryzen 5 5500',
      source: 'systeminformation',
      generic: false,
    });
  });

  it('formata o genérico quando nenhuma fonte tem o nome comercial', () => {
    expect(
      resolveCpuName({
        wmiName: 'AMD64 Family 25 Model 80 Stepping 0',
        osModel: 'AMD64 Family 25 Model 80 Stepping 0',
      })
    ).toMatchObject({
      name: 'AMD (Família 25 · Modelo 80)',
      source: 'generic',
      generic: true,
      family: '25',
      modelNumber: '80',
      stepping: '0',
    });
  });

  it('extrai família/modelo do Description mesmo com nome comercial', () => {
    expect(
      resolveCpuName({
        wmiName: 'AMD Ryzen 5 5500 6-Core Processor',
        description: 'AMD64 Family 25 Model 80 Stepping 0',
      })
    ).toMatchObject({
      name: 'AMD Ryzen 5 5500',
      family: '25',
      modelNumber: '80',
      stepping: '0',
    });
  });

  it('retorna Unknown quando não há nenhuma fonte', () => {
    expect(resolveCpuName({})).toMatchObject({
      name: 'Unknown',
      source: 'unknown',
      generic: true,
    });
  });
});

describe('parseWmiProcessor', () => {
  it('aceita objeto único e array', () => {
    const item = {
      Name: 'AMD Ryzen 5 5500 6-Core Processor',
      Manufacturer: 'AuthenticAMD',
      NumberOfCores: 6,
      NumberOfLogicalProcessors: 12,
    };

    expect(parseWmiProcessor(JSON.stringify(item))).toMatchObject({
      name: item.Name,
      manufacturer: 'AuthenticAMD',
      numberOfCores: 6,
      numberOfLogicalProcessors: 12,
    });
    expect(parseWmiProcessor(JSON.stringify([item]))).toMatchObject({ name: item.Name });
  });

  it('ignora JSON inválido', () => {
    expect(parseWmiProcessor('not json')).toEqual({});
    expect(parseWmiProcessor('')).toEqual({});
  });
});

describe('buildCpuInfo', () => {
  it('prefere o WMI e mantém núcleos/threads reais', () => {
    const info = buildCpuInfo({
      osModel: 'AMD64 Family 25 Model 80 Stepping 0',
      logicalCount: 12,
      wmiRaw: JSON.stringify({
        Name: 'AMD Ryzen 5 5500 6-Core Processor',
        Manufacturer: 'AuthenticAMD',
        Description: 'AMD64 Family 25 Model 80 Stepping 0',
        NumberOfCores: 6,
        NumberOfLogicalProcessors: 12,
        MaxClockSpeed: 3600,
      }),
      architecture: 'x64',
      usage: 5,
    });

    expect(info.model).toBe('AMD Ryzen 5 5500');
    expect(info.vendor).toBe('amd');
    expect(info.cores).toBe(6);
    expect(info.logicalProcessors).toBe(12);
    expect(info.family).toBe('25');
    expect(info.modelNumber).toBe('80');
    expect(info.stepping).toBe('0');
    expect(info.nameSource).toBe('wmi');
    expect(info.nameIsGeneric).toBe(false);
    expect(info.coresEstimated).toBe(false);
    expect(info.maxClockMhz).toBe(3600);
  });

  it('cai para o os.cpus() quando o WMI não responde e marca núcleos como estimados', () => {
    const info = buildCpuInfo({
      osModel: 'AMD Ryzen 5 5500 6-Core Processor',
      logicalCount: 12,
      architecture: 'x64',
      usage: 0,
    });

    expect(info.model).toBe('AMD Ryzen 5 5500');
    expect(info.vendor).toBe('amd');
    expect(info.cores).toBe(12);
    expect(info.coresEstimated).toBe(true);
    expect(info.nameSource).toBe('os');
  });

  it('usa physicalCores do systeminformation quando o WMI falha', () => {
    const info = buildCpuInfo({
      osModel: 'AMD Ryzen 5 5500 6-Core Processor',
      logicalCount: 12,
      identity: {
        manufacturer: 'AMD',
        brand: 'Ryzen 5 5500 6-Core Processor',
        physicalCores: 6,
      },
      architecture: 'x64',
      usage: 0,
    });

    expect(info.cores).toBe(6);
    expect(info.coresEstimated).toBe(false);
  });

  it('formata o identificador genérico quando todas as fontes são genéricas', () => {
    const info = buildCpuInfo({
      osModel: 'AMD64 Family 25 Model 80 Stepping 0',
      logicalCount: 12,
      wmiRaw: JSON.stringify({
        Name: 'AMD64 Family 25 Model 80 Stepping 0',
        Manufacturer: 'AuthenticAMD',
      }),
      architecture: 'x64',
      usage: 0,
    });

    expect(info.model).toBe('AMD (Família 25 · Modelo 80)');
    expect(info.nameSource).toBe('generic');
    expect(info.nameIsGeneric).toBe(true);
  });
});
