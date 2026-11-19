import { describe, expect, it } from 'vitest';
import type { GpuCatalogEntry } from '../../electron/shared/ipc-types';
import { findUserGpu, normalizeGpuName } from './gpu-match';

function gpu(id: string, name: string): GpuCatalogEntry {
  return { id, name, manufacturer: 'NVIDIA', performanceScore: 100 };
}

const catalog = [
  gpu('rtx-4060-ti-16', 'GeForce RTX 4060 Ti 16 GB'),
  gpu('rtx-4060-ti', 'GeForce RTX 4060 Ti'),
  gpu('rtx-4060', 'GeForce RTX 4060'),
  gpu('rx-7600', 'Radeon RX 7600'),
];

describe('normalizeGpuName', () => {
  it('remove fabricante, caixa e pontuação', () => {
    expect(normalizeGpuName('NVIDIA GeForce RTX 4060')).toBe('geforce rtx 4060');
    expect(normalizeGpuName('AMD Radeon RX 7600')).toBe('radeon rx 7600');
    expect(normalizeGpuName('  GeForce   RTX 4060  ')).toBe('geforce rtx 4060');
  });
});

describe('findUserGpu', () => {
  it('seleciona a placa detectada pelo nome padronizado', () => {
    expect(findUserGpu(catalog, 'NVIDIA GeForce RTX 4060')?.id).toBe('rtx-4060');
    expect(findUserGpu(catalog, 'AMD Radeon RX 7600')?.id).toBe('rx-7600');
  });

  it('aceita variação de VRAM e sufixo OEM', () => {
    expect(findUserGpu(catalog, 'NVIDIA GeForce RTX 4060 Ti 16GB')?.id).toBe('rtx-4060-ti-16');
    expect(findUserGpu(catalog, 'NVIDIA GeForce RTX 4060 Ti OEM')?.id).toBe('rtx-4060-ti');
  });

  it('não inventa correspondência quando a placa não está no catálogo', () => {
    expect(findUserGpu(catalog, 'GeForce RTX 5050')).toBeUndefined();
    expect(findUserGpu(catalog, undefined)).toBeUndefined();
  });
});
