import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  written: [] as Array<{ path: string; content: string }>,
}));

vi.mock('node:fs', () => ({
  existsSync: (path: string) => mocks.files.has(path),
  readFileSync: (path: string) => mocks.files.get(path) ?? '',
  writeFileSync: (path: string, content: string) => {
    mocks.written.push({ path, content });
  },
  renameSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\UserData', getAppPath: () => 'C:\\App' },
}));

const originalResourcesPath = process.resourcesPath;

import type { GpuCatalog } from '../../shared/ipc-types';
import { GPU_CATALOG_URL, getGpuCatalog } from '../services/gpu-catalog';

const dataset: GpuCatalog = {
  version: 1,
  source: 'FM Optimize',
  sourceUrl: 'https://example.com/dataset.json',
  updatedAt: '2026-01-01T00:00:00.000Z',
  gpus: [
    {
      id: 'rtx-4060',
      name: 'GeForce RTX 4060',
      manufacturer: 'NVIDIA',
      architecture: 'Ada Lovelace',
      vramGb: 8,
      vramType: 'GDDR6',
      tdpWatts: 115,
      releaseYear: 2023,
      performanceScore: 100,
    },
  ],
};

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

beforeEach(() => {
  mocks.files.clear();
  mocks.written = [];
});

afterEach(() => {
  Object.defineProperty(process, 'resourcesPath', {
    value: originalResourcesPath,
    configurable: true,
  });
});

describe('getGpuCatalog', () => {
  it('carrega o dataset público pela URL configurada e o normaliza', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        ...dataset,
        gpus: [
          {
            ...dataset.gpus[0],
            name: '  GeForce   RTX  4060  ',
            manufacturer: 'nvidia',
            performanceScore: 100.4,
          },
        ],
      })
    );

    const result = await getGpuCatalog({ fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      GPU_CATALOG_URL,
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(result.gpus[0]).toMatchObject({
      name: 'GeForce RTX 4060',
      manufacturer: 'NVIDIA',
      performanceScore: 100.4,
    });
    expect(mocks.written).toHaveLength(1);
    expect(mocks.written[0].path).toContain('gpu-catalog.json');
  });

  it('usa o cache quando a rede falha e sinaliza a origem', async () => {
    mocks.files.set(
      'C:\\UserData\\gpu-catalog.json',
      JSON.stringify({
        version: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        data: dataset,
      })
    );
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await getGpuCatalog({ fetchFn });

    expect(result.gpus).toEqual(dataset.gpus);
    expect(result.isFromCache).toBe(true);
  });

  it('usa o dataset incluído no app no dev, quando resourcesPath é a pasta interna do Electron', async () => {
    Object.defineProperty(process, 'resourcesPath', {
      value: 'C:\\ElectronResources',
      configurable: true,
    });
    mocks.files.set('C:\\App\\resources\\gpu-dataset.json', JSON.stringify(dataset));
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await getGpuCatalog({ fetchFn });

    expect(result.gpus).toEqual(dataset.gpus);
    expect(result.isFromCache).toBe(true);
  });

  it('propaga o erro quando a rede falha e não há cache', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(getGpuCatalog({ fetchFn })).rejects.toThrow(
      /não foi possível carregar o catálogo de placas de vídeo/i
    );
  });

  it('rejeita um dataset inválido', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ version: 1, gpus: 'invalid' }));

    await expect(getGpuCatalog({ fetchFn })).rejects.toThrow(
      /catálogo de placas de vídeo inválido/i
    );
  });
});
