// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CleanerItemStats, CleanItemsResult } from '../../electron/shared/ipc-types';
import { useCleanerItems } from './use-cleaner-items';

/**
 * O hook busca as estatísticas por item uma única vez (a varredura no main já
 * devolve tudo), guarda cache de 5 minutos e expõe a execução da limpeza. O
 * cache evita que a lista pisque a cada navegação.
 */

const CACHE_KEY = 'fm-cleaner-items';

function item(overrides: Partial<CleanerItemStats> = {}): CleanerItemStats {
  return {
    id: 'temp-user',
    label: 'Temp do Usuário',
    description: 'temporários',
    group: 'sistema',
    requiresAdmin: false,
    fileCount: 1,
    totalSizeBytes: 1024,
    ...overrides,
  };
}

const getCleanerItemsStats = vi.fn<() => Promise<CleanerItemStats[]>>();
const cleanItems = vi.fn<(ids: string[]) => Promise<CleanItemsResult>>();

function installApi(
  statsImpl?: () => Promise<CleanerItemStats[]>,
  cleanImpl?: (ids: string[]) => Promise<CleanItemsResult>
) {
  getCleanerItemsStats.mockReset();
  getCleanerItemsStats.mockImplementation(statsImpl ?? (async () => [item()]));
  cleanItems.mockReset();
  cleanItems.mockImplementation(
    cleanImpl ??
      (async () => ({
        items: [{ id: 'temp-user', label: 'Temp do Usuário', freedBytes: 100, removedFiles: 2 }],
        freedBytes: 100,
        removedFiles: 2,
        failed: 0,
      }))
  );
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getCleanerItemsStats,
    cleanItems,
  };
  return getCleanerItemsStats;
}

function writeCache(items: unknown, timestamp: number) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useCleanerItems — carga inicial', () => {
  it('começa carregando e preenche a lista de itens', async () => {
    const api = installApi(async () => [
      item({ id: 'chrome', label: 'Cache do Chrome', group: 'navegadores', fileCount: 42 }),
      item(),
    ]);

    const { result } = renderHook(() => useCleanerItems());

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api).toHaveBeenCalledTimes(1);
    expect(result.current.items.map((entry) => entry.id)).toEqual(['chrome', 'temp-user']);
    expect(result.current.lastRefreshed).toBeGreaterThan(0);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('grava o resultado no cache', async () => {
    installApi(async () => [item({ fileCount: 7 })]);
    const { result } = renderHook(() => useCleanerItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    expect(cached.items[0].fileCount).toBe(7);
    expect(typeof cached.timestamp).toBe('number');
  });

  it('encerra o loading com erro quando a varredura falha sem cache', async () => {
    installApi(async () => {
      throw new Error('acesso negado');
    });

    const { result } = renderHook(() => useCleanerItems());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('acesso negado');
  });
});

describe('useCleanerItems — cache', () => {
  it('usa o cache válido sem passar pelo loading e atualiza em segundo plano', async () => {
    writeCache([item({ fileCount: 42 })], Date.now());
    installApi(async () => [item({ fileCount: 9 })]);

    const { result } = renderHook(() => useCleanerItems());

    expect(result.current.loading).toBe(false);
    expect(result.current.items[0].fileCount).toBe(42);
    expect(result.current.lastRefreshed).toBeGreaterThan(0);

    await waitFor(() => expect(result.current.items[0].fileCount).toBe(9));
  });

  it('descarta cache expirado e recarrega', async () => {
    writeCache([item({ fileCount: 42 })], Date.now() - 6 * 60 * 1000);
    installApi(async () => [item({ fileCount: 9 })]);

    const { result } = renderHook(() => useCleanerItems());

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.lastRefreshed).toBe(0);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items[0].fileCount).toBe(9);
  });

  it('ignora cache corrompido sem quebrar', async () => {
    localStorage.setItem(CACHE_KEY, '{ isso não é json');
    installApi();

    const { result } = renderHook(() => useCleanerItems());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });

  it('ignora cache sem o campo items', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now() }));
    installApi();

    const { result } = renderHook(() => useCleanerItems());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe('useCleanerItems — atualização manual', () => {
  it('sinaliza isRefreshing durante a busca e substitui os dados', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerItems());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const gate = deferred<void>();
    getCleanerItemsStats.mockImplementation(async () => {
      await gate.promise;
      return [item({ fileCount: 7 })];
    });

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      gate.resolve();
      await refreshPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.items[0].fileCount).toBe(7);
  });

  it('expõe o erro do refresh sem apagar a lista atual', async () => {
    installApi(async () => [item({ fileCount: 3 })]);
    const { result } = renderHook(() => useCleanerItems());
    await waitFor(() => expect(result.current.loading).toBe(false));

    getCleanerItemsStats.mockImplementation(async () => {
      throw new Error('sem permissão');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('sem permissão');
    expect(result.current.items[0].fileCount).toBe(3);
  });
});

describe('useCleanerItems — limpeza', () => {
  it('repassa os ids escolhidos e devolve o resultado do main', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerItems());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let cleaned!: CleanItemsResult;
    await act(async () => {
      cleaned = await result.current.clean(['chrome', 'temp-user']);
    });

    expect(cleanItems).toHaveBeenCalledWith(['chrome', 'temp-user']);
    expect(cleaned.freedBytes).toBe(100);
    expect(cleaned.removedFiles).toBe(2);
  });
});
