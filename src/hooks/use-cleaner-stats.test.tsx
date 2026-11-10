// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CleanerStats } from '../../electron/shared/ipc-types';
import {
  formatBytes as formatBytesFromUtils,
  formatDuration as formatDurationFromUtils,
} from '../utils/format';
import { formatBytes, formatDuration, useCleanerStats } from './use-cleaner-stats';

/**
 * O hook busca as estatísticas dos quatro limpadores em paralelo, tolera falhas
 * individuais e mantém um cache de 5 minutos no localStorage para a página não
 * piscar a cada navegação.
 */

const CACHE_KEY = 'fm-cleaner-stats';
const CLEANER_IDS = ['cleaner-1', 'cleaner-2', 'cleaner-3', 'cleaner-4'];

function stats(overrides: Partial<CleanerStats> = {}): CleanerStats {
  return {
    fileCount: 1,
    totalSizeBytes: 1024,
    estimatedSeconds: 2,
    categories: [],
    ...overrides,
  };
}

const getCleanerStats = vi.fn<(id: string) => Promise<CleanerStats>>();

function installApi(impl?: (id: string) => Promise<CleanerStats>) {
  getCleanerStats.mockReset();
  getCleanerStats.mockImplementation(
    impl ?? (async (id: string) => stats({ fileCount: Number(id.slice(-1)) }))
  );
  (window as unknown as { electronAPI: unknown }).electronAPI = { getCleanerStats };
  return getCleanerStats;
}

function writeCache(data: unknown, timestamp: number) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ stats: data, timestamp }));
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

describe('useCleanerStats — carga inicial', () => {
  it('começa carregando e preenche os quatro limpadores', async () => {
    const api = installApi();
    const { result } = renderHook(() => useCleanerStats());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api).toHaveBeenCalledTimes(4);
    expect(Object.keys(result.current.stats).sort()).toEqual(CLEANER_IDS);
    expect(result.current.stats['cleaner-3'].fileCount).toBe(3);
    expect(result.current.lastRefreshed).toBeGreaterThan(0);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('grava o resultado no cache', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerStats());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    expect(cached.stats['cleaner-1'].fileCount).toBe(1);
    expect(typeof cached.timestamp).toBe('number');
  });

  it('marca como erro apenas o limpador que falhou', async () => {
    installApi(async (id) => {
      if (id === 'cleaner-2') throw new Error('acesso negado');
      return stats({ fileCount: 9 });
    });

    const { result } = renderHook(() => useCleanerStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats['cleaner-1'].fileCount).toBe(9);
    expect(result.current.stats['cleaner-2']).toEqual({
      fileCount: 0,
      totalSizeBytes: 0,
      estimatedSeconds: 0,
      categories: [],
      error: true,
    });
  });

  it('encerra o loading mesmo com todos os limpadores falhando', async () => {
    installApi(async () => {
      throw new Error('sem permissão');
    });

    const { result } = renderHook(() => useCleanerStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (const id of CLEANER_IDS) {
      expect(result.current.stats[id].error).toBe(true);
    }
  });
});

describe('useCleanerStats — cache', () => {
  it('usa o cache válido sem passar pelo loading', async () => {
    writeCache({ 'cleaner-1': stats({ fileCount: 42 }) }, Date.now());
    installApi();

    const { result } = renderHook(() => useCleanerStats());

    expect(result.current.loading).toBe(false);
    expect(result.current.stats['cleaner-1'].fileCount).toBe(42);
    expect(result.current.lastRefreshed).toBeGreaterThan(0);

    // A busca em segundo plano ainda acontece e substitui o cache.
    await waitFor(() => expect(Object.keys(result.current.stats)).toHaveLength(4));
  });

  it('descarta cache expirado e recarrega', async () => {
    writeCache({ 'cleaner-1': stats({ fileCount: 42 }) }, Date.now() - 6 * 60 * 1000);
    installApi();

    const { result } = renderHook(() => useCleanerStats());

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.lastRefreshed).toBe(0);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats['cleaner-1'].fileCount).toBe(1);
  });

  it('ignora cache corrompido sem quebrar', async () => {
    localStorage.setItem(CACHE_KEY, '{ isso não é json');
    installApi();

    const { result } = renderHook(() => useCleanerStats());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats['cleaner-1'].fileCount).toBe(1);
  });

  it('ignora cache sem o campo stats', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now() }));
    installApi();

    const { result } = renderHook(() => useCleanerStats());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe('useCleanerStats — atualização manual', () => {
  it('sinaliza isRefreshing durante a busca e substitui os dados', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const gate = deferred<void>();
    getCleanerStats.mockImplementation(async () => {
      await gate.promise;
      return stats({ fileCount: 7 });
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
    expect(result.current.stats['cleaner-1'].fileCount).toBe(7);
  });

  it('guarda o estado anterior para a comparação da página', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    getCleanerStats.mockImplementation(async () => stats({ fileCount: 7 }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.previousStats.current['cleaner-1'].fileCount).toBe(1);
    expect(result.current.stats['cleaner-1'].fileCount).toBe(7);
  });

  it('atualiza o cache e o lastRefreshed após o refresh', async () => {
    installApi();
    const { result } = renderHook(() => useCleanerStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = result.current.lastRefreshed;
    getCleanerStats.mockImplementation(async () => stats({ fileCount: 5 }));

    await act(async () => {
      await result.current.refresh();
    });

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    expect(cached.stats['cleaner-1'].fileCount).toBe(5);
    expect(result.current.lastRefreshed).toBeGreaterThanOrEqual(before);
  });
});

describe('useCleanerStats — utilitários reexportados', () => {
  it('reexporta os mesmos formatadores da camada de utils', () => {
    expect(formatBytes).toBe(formatBytesFromUtils);
    expect(formatDuration).toBe(formatDurationFromUtils);
  });
});
