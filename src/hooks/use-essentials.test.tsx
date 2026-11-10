// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EssentialInstallProgress, EssentialListItem } from '../../electron/shared/ipc-types';

/**
 * A página de Essenciais depende de três coisas: a lista do winget, o progresso
 * empurrado pelo main e o resultado de cada instalação. O teste mocka o toast e
 * a API; o hook roda de verdade.
 */

const store = vi.hoisted(() => ({
  soundEnabled: true,
  toast: vi.fn(),
}));

vi.mock('../components/EnhancedToast', () => ({
  showEnhancedToast: store.toast,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: { soundEnabled: store.soundEnabled },
    update: () => {},
    loading: false,
  }),
}));

import { useEssentials } from './use-essentials';

const ITEMS: EssentialListItem[] = [
  {
    id: 'vcredist',
    name: 'Visual C++ Redistributable',
    description: 'Bibliotecas para jogos',
    pageUrl: 'https://example.com/vcredist',
    packageId: 'Microsoft.VCRedist.2015+.x64',
  },
  {
    id: 'directx',
    name: 'DirectX',
    description: 'Runtime do DirectX',
    pageUrl: 'https://example.com/directx',
    packageId: 'Microsoft.DirectX',
  },
];

function installApi(overrides: Record<string, unknown> = {}) {
  const progressCallbacks: Array<(data: EssentialInstallProgress) => void> = [];
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  const api = {
    getEssentials: vi.fn(async () => ITEMS),
    onEssentialInstallProgress: vi.fn((cb: (data: EssentialInstallProgress) => void) => {
      progressCallbacks.push(cb);
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    }),
    installEssential: vi.fn(async () => ({ id: 'vcredist', alreadyInstalled: false })),
    cancelEssentialInstall: vi.fn(async () => undefined),
    openEssentialPage: vi.fn(async () => undefined),
    ...overrides,
  };

  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return { api, progressCallbacks, unsubscribes };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  store.soundEnabled = true;
  store.toast.mockClear();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useEssentials — lista', () => {
  it('carrega a lista de essenciais', async () => {
    installApi();
    const { result } = renderHook(() => useEssentials());

    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state).toEqual({ status: 'success', data: ITEMS });
  });

  it('expõe a mensagem quando a lista falha', async () => {
    installApi({
      getEssentials: vi.fn(async () => Promise.reject(new Error('winget fora do ar'))),
    });

    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    expect(result.current.state).toEqual({ status: 'error', error: 'winget fora do ar' });
  });

  it('aceita erro em string, sem depender de Error', async () => {
    installApi({ getEssentials: vi.fn(async () => Promise.reject('sem winget')) });

    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    expect(result.current.state).toEqual({ status: 'error', error: 'sem winget' });
  });

  it('recarrega sob demanda', async () => {
    const { api } = installApi();
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.reload());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(api.getEssentials).toHaveBeenCalledTimes(2);
  });

  it('guarda o progresso empurrado pelo main', async () => {
    const { progressCallbacks } = installApi();
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => progressCallbacks[0]({ id: 'vcredist', status: 'downloading', percent: 42 }));

    expect(result.current.installProgress.vcredist).toEqual({
      id: 'vcredist',
      status: 'downloading',
      percent: 42,
    });
  });

  it('cancela a inscrição de progresso ao desmontar', async () => {
    const { unsubscribes } = installApi();
    const { unmount } = renderHook(() => useEssentials());
    await waitFor(() => expect(unsubscribes).toHaveLength(1));

    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
  });
});

describe('useEssentials — instalação', () => {
  it('registra o resultado e avisa com toast de sucesso', async () => {
    const { api } = installApi();
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });

    expect(api.installEssential).toHaveBeenCalledWith('vcredist');
    expect(result.current.installs.vcredist).toEqual({ id: 'vcredist', alreadyInstalled: false });
    expect(result.current.running.vcredist).toBe(false);
    expect(store.toast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Visual C++ Redistributable instalado',
      description: 'Instalado pelo winget, com o hash do manifesto verificado.',
      sound: true,
    });
  });

  it('avisa que já estava instalado sem dizer que instalou', async () => {
    installApi({
      installEssential: vi.fn(async () => ({ id: 'directx', alreadyInstalled: true })),
    });
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[1]);
    });

    expect(result.current.installs.directx).toEqual({ id: 'directx', alreadyInstalled: true });
    expect(store.toast).toHaveBeenCalledWith({
      type: 'info',
      title: 'DirectX já está instalado',
      description: 'Nenhuma alteração foi feita neste PC.',
      sound: true,
    });
  });

  it('propaga o som desligado para o toast', async () => {
    store.soundEnabled = false;
    installApi();
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });

  it('guarda o erro e avisa quando a instalação falha', async () => {
    installApi({
      installEssential: vi.fn(async () => Promise.reject(new Error('hash inválido'))),
    });
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });

    expect(result.current.errors.vcredist).toBe('hash inválido');
    expect(result.current.running.vcredist).toBe(false);
    expect(store.toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Falha na instalação',
      description: 'hash inválido',
    });
  });

  it('não trata cancelamento como erro', async () => {
    installApi({
      installEssential: vi.fn(async () => Promise.reject(new Error('Instalação cancelada.'))),
    });
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });

    expect(result.current.errors.vcredist).toBeUndefined();
    expect(result.current.running.vcredist).toBe(false);
    expect(store.toast).not.toHaveBeenCalled();
  });

  it('marca running durante a instalação e limpa o progresso no fim', async () => {
    const gate = deferred<{ id: string; alreadyInstalled: boolean }>();
    const { progressCallbacks } = installApi({
      installEssential: vi.fn(() => gate.promise),
    });
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => progressCallbacks[0]({ id: 'vcredist', status: 'installing', percent: null }));

    let installPromise!: Promise<void>;
    act(() => {
      installPromise = result.current.install(ITEMS[0]);
    });

    expect(result.current.running.vcredist).toBe(true);
    expect(result.current.installProgress.vcredist).toBeDefined();

    await act(async () => {
      gate.resolve({ id: 'vcredist', alreadyInstalled: false });
      await installPromise;
    });

    expect(result.current.running.vcredist).toBe(false);
    expect(result.current.installProgress.vcredist).toBeUndefined();
  });

  it('limpa o erro anterior ao tentar de novo', async () => {
    installApi({
      installEssential: vi
        .fn()
        .mockRejectedValueOnce(new Error('primeira falha'))
        .mockResolvedValueOnce({ id: 'vcredist', alreadyInstalled: false }),
    });
    const { result } = renderHook(() => useEssentials());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });
    expect(result.current.errors.vcredist).toBe('primeira falha');

    await act(async () => {
      await result.current.install(ITEMS[0]);
    });
    expect(result.current.errors.vcredist).toBeUndefined();
  });
});

describe('useEssentials — ações auxiliares', () => {
  it('cancela a instalação pelo id', async () => {
    const { api } = installApi();
    const { result } = renderHook(() => useEssentials());

    act(() => result.current.cancelInstall('vcredist'));

    await waitFor(() => expect(api.cancelEssentialInstall).toHaveBeenCalledWith('vcredist'));
  });

  it('engole a falha ao cancelar', async () => {
    installApi({ cancelEssentialInstall: vi.fn(async () => Promise.reject(new Error('sumiu'))) });
    const { result } = renderHook(() => useEssentials());

    expect(() => act(() => result.current.cancelInstall('vcredist'))).not.toThrow();
  });

  it('abre a página oficial do item', async () => {
    const { api } = installApi();
    const { result } = renderHook(() => useEssentials());

    act(() => result.current.openPage(ITEMS[1]));

    await waitFor(() => expect(api.openEssentialPage).toHaveBeenCalledWith('directx'));
  });

  it('engole a falha ao abrir a página', async () => {
    installApi({
      openEssentialPage: vi.fn(async () => Promise.reject(new Error('sem navegador'))),
    });
    const { result } = renderHook(() => useEssentials());

    expect(() => act(() => result.current.openPage(ITEMS[0]))).not.toThrow();
  });
});
