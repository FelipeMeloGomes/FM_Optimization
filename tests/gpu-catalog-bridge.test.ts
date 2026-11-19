import { beforeAll, describe, expect, it, vi } from 'vitest';

type CatalogBridge = {
  getGpuCatalog(): Promise<unknown>;
  searchGpu(name: string): Promise<unknown>;
};

const mocks = vi.hoisted(() => ({
  exposed: null as unknown,
  invoke: vi.fn(async () => ({ success: true, data: { gpus: [] } })),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_key: string, api: unknown) => {
      mocks.exposed = api;
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: () => () => {},
    removeListener: vi.fn(),
  },
}));

beforeAll(async () => {
  await import('../electron/preload/index');
});

function api(): CatalogBridge {
  return mocks.exposed as CatalogBridge;
}

describe('bridge do catálogo de GPUs', () => {
  it('expõe getGpuCatalog e chama o canal get-gpu-catalog', async () => {
    expect(typeof api().getGpuCatalog).toBe('function');

    await expect(api().getGpuCatalog()).resolves.toEqual({ gpus: [] });
    expect(mocks.invoke).toHaveBeenCalledWith('get-gpu-catalog');
  });

  it('rejeita quando o main process devolve erro', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: false, error: 'catálogo indisponível' });

    await expect(api().getGpuCatalog()).rejects.toBe('catálogo indisponível');
  });

  it('expõe searchGpu e envia o nome digitado ao canal search-gpu', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: true, data: null });

    await expect(api().searchGpu('RTX 4090')).resolves.toBeNull();
    expect(mocks.invoke).toHaveBeenCalledWith('search-gpu', 'RTX 4090');
  });
});
