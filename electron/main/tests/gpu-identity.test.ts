import { describe, expect, it } from 'vitest';
import { formatGpuName, trimGpuName } from '../services/gpu-identity';

/**
 * O nome da GPU vem cru do WMI, e cada fabricante o registra de um jeito:
 * marcas registradas na Intel, `Series` na AMD e `Laptop GPU` na NVIDIA.
 * Estes testes fixam o padrão `Fabricante + Linha + Modelo` para que a UI
 * mostre o mesmo formato em todas as máquinas.
 */
describe('formatGpuName', () => {
  const cases: Array<[string, string]> = [
    ['AMD Radeon RX 7600', 'AMD Radeon RX 7600'],
    ['AMD Radeon(TM) Graphics', 'AMD Radeon Graphics'],
    ['AMD Radeon RX 580 Series', 'AMD Radeon RX 580'],
    ['AMD Radeon RX 7600 XT', 'AMD Radeon RX 7600 XT'],
    ['AMD Radeon Pro W6800', 'AMD Radeon Pro W6800'],
    ['NVIDIA GeForce RTX 3060 Laptop GPU', 'NVIDIA GeForce RTX 3060 Laptop'],
    ['NVIDIA GeForce RTX 4070 Ti SUPER', 'NVIDIA GeForce RTX 4070 Ti SUPER'],
    ['NVIDIA GeForce GTX 1650 with Max-Q Design', 'NVIDIA GeForce GTX 1650'],
    ['Intel(R) UHD Graphics 630', 'Intel UHD Graphics 630'],
    ['Intel(R) Iris(R) Xe Graphics', 'Intel Iris Xe Graphics'],
    ['Intel(R) Arc(TM) A770 Graphics', 'Intel Arc A770 Graphics'],
    ['Microsoft Basic Display Adapter', 'Microsoft Basic Display Adapter'],
  ];

  it.each(cases)('%s → %s', (raw, expected) => {
    expect(formatGpuName(raw)).toBe(expected);
  });

  it('é idempotente', () => {
    for (const [, expected] of cases) {
      expect(formatGpuName(expected)).toBe(expected);
    }
  });

  it('preserva o identificador do modelo', () => {
    expect(formatGpuName('NVIDIA GeForce RTX 4090')).toBe('NVIDIA GeForce RTX 4090');
    expect(formatGpuName('AMD Radeon RX 6750 XT')).toBe('AMD Radeon RX 6750 XT');
    expect(formatGpuName('Intel(R) Arc(TM) B580 Graphics')).toBe('Intel Arc B580 Graphics');
  });

  it('nunca devolve vazio', () => {
    expect(formatGpuName('')).toBe('N/A');
    expect(formatGpuName('   ')).toBe('N/A');
    expect(formatGpuName(undefined)).toBe('N/A');
  });
});

describe('trimGpuName', () => {
  it('remove padding e quebras de linha do WMI', () => {
    expect(trimGpuName('  AMD Radeon RX 7600 \r\n')).toBe('AMD Radeon RX 7600');
  });
});
