import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => files.has(path)),
  readFileSync: vi.fn((path: string) => files.get(path) ?? ''),
  renameSync: vi.fn((from: string, to: string) => {
    const content = files.get(from);
    if (content !== undefined) files.set(to, content);
    files.delete(from);
  }),
  writeFileSync: vi.fn((path: string, content: string) => {
    files.set(path, content);
  }),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'C:/Users/Test/AppData/Roaming/fm-optimize') },
}));

import type { DashboardData } from '../../shared/ipc-types';
import { readSystemCache, writeSystemCache } from '../services/system-info-cache';

const CACHE_PATH = join('C:/Users/Test/AppData/Roaming/fm-optimize', 'system-cache.json');

const dashboard: DashboardData = {
  cpu: {
    model: 'AMD Ryzen 7 5700X',
    manufacturer: 'AMD',
    vendor: 'amd',
    cores: 8,
    logicalProcessors: 16,
    architecture: 'x64',
    usage: 10,
  },
  gpu: { name: 'AMD Radeon RX 7600', vram: '8 GB', driverVersion: '1.0', usage: 5 },
  memory: {
    total: '32 GB',
    used: '12 GB',
    free: '20 GB',
    type: 'DDR4',
    frequency: '3200 MHz',
    slots: 2,
  },
  drives: [
    {
      letter: 'C:',
      label: 'Sistema',
      size: '1 TB',
      free: '400 GB',
      usedPercent: 60,
      type: 'SSD NVMe',
      fileSystem: 'NTFS',
    },
  ],
  os: {
    name: 'Windows 11 Pro',
    version: '11',
    build: '26100',
    edition: 'Pro',
    installDate: '2024-01-01',
  },
  uptime: 90000,
};

beforeEach(() => {
  files.clear();
});

describe('system-info-cache', () => {
  it('descarta caches antigos sem a identidade da mídia', () => {
    files.set(
      CACHE_PATH,
      JSON.stringify({ version: 1, timestamp: new Date().toISOString(), data: dashboard })
    );

    expect(readSystemCache()).toBeNull();
  });

  it('descarta caches da versão 2 sem placa-mãe e caches', () => {
    files.set(
      CACHE_PATH,
      JSON.stringify({ version: 2, timestamp: new Date().toISOString(), data: dashboard })
    );

    expect(readSystemCache()).toBeNull();
  });

  it('aceita e persiste caches na versão atual', () => {
    writeSystemCache(dashboard);

    expect(readSystemCache()?.data.drives[0].type).toBe('SSD NVMe');
  });
});
