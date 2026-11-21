// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, DashboardData, StorageDrive } from '../../electron/shared/ipc-types';

const store = vi.hoisted(() => ({
  system: { status: 'success', data: { drives: [] } } as unknown as AsyncState<DashboardData>,
  hasFetched: true,
  refresh: vi.fn(),
}));

vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({
    state: store.system,
    refreshing: false,
    refresh: store.refresh,
    hasFetched: store.hasFetched,
    isFromCache: true,
  }),
}));

const api = vi.hoisted(() => ({
  runDiskCleanup: vi.fn<(letter: string) => Promise<void>>(),
  optimizeDrive: vi.fn<(letter: string) => Promise<void>>(),
}));

import { useStorageDrives } from './use-storage-drives';

function drive(letter: string, type: string): StorageDrive {
  return {
    letter,
    label: `Disco ${letter}`,
    size: '512 GB',
    free: '200 GB',
    usedPercent: 60,
    type,
  };
}

beforeEach(() => {
  store.system = {
    status: 'success',
    data: { drives: [drive('C:', 'SSD'), drive('D:', 'HD')] } as unknown as DashboardData,
  };
  store.hasFetched = true;
  store.refresh.mockReset();
  api.runDiskCleanup.mockReset().mockResolvedValue(undefined);
  api.optimizeDrive.mockReset().mockResolvedValue(undefined);
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
});

describe('useStorageDrives', () => {
  it('atualiza o contexto na montagem quando ainda não houve leitura', () => {
    store.hasFetched = false;
    renderHook(() => useStorageDrives());
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });

  it('não refetch quando o contexto já leu os dados', () => {
    renderHook(() => useStorageDrives());
    expect(store.refresh).not.toHaveBeenCalled();
  });

  it('seleciona e marca otimização por letra, normalizando para maiúsculas', () => {
    const { result } = renderHook(() => useStorageDrives());
    act(() => result.current.toggleSelected('c:'));
    expect(result.current.selected.has('C:')).toBe(true);
    act(() => result.current.toggleOptimize('C:'));
    expect(result.current.optimizeFlags.has('C:')).toBe(true);
    act(() => result.current.toggleSelected('C:'));
    expect(result.current.selected.has('C:')).toBe(false);
  });

  it('chama a API com a letra, marca ocupado e registra sucesso', async () => {
    let resolve!: () => void;
    api.runDiskCleanup.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const { result } = renderHook(() => useStorageDrives());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.cleanup('c:');
    });
    expect(result.current.busy.has('C:')).toBe(true);
    resolve();
    await act(async () => {
      await pending;
    });
    expect(api.runDiskCleanup).toHaveBeenCalledWith('C:');
    expect(result.current.applied['C:']).toBe(true);
    expect(result.current.busy.has('C:')).toBe(false);
    expect(store.refresh).toHaveBeenCalled();
  });

  it('registra erro por unidade e limpa o estado ocupado', async () => {
    api.optimizeDrive.mockRejectedValue(new Error('acesso negado'));
    const { result } = renderHook(() => useStorageDrives());
    await act(async () => {
      await result.current.optimize('D:');
    });
    expect(result.current.errors['D:']).toBe('acesso negado');
    expect(result.current.busy.has('D:')).toBe(false);
    expect(result.current.applied['D:']).toBeUndefined();
  });

  it('no lote limpa todas as selecionadas e otimiza só as SSDs sinalizadas', async () => {
    const { result } = renderHook(() => useStorageDrives());
    act(() => {
      result.current.toggleSelected('C:');
      result.current.toggleSelected('D:');
      result.current.toggleOptimize('C:');
      result.current.toggleOptimize('D:');
    });
    await act(async () => {
      await result.current.cleanupSelected();
    });
    expect(api.runDiskCleanup.mock.calls.map((c) => c[0])).toEqual(['C:', 'D:']);
    expect(api.optimizeDrive.mock.calls.map((c) => c[0])).toEqual(['C:']);
  });
});
