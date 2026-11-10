// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateInfo, UpdateStatus } from '../../electron/shared/ipc-types';

/**
 * O toast de atualização traduz três eventos do updater: "ready" vira ação de
 * instalar, "error" vira aviso de falha e "update-info" com versão vira ação de
 * baixar. Os demais estados não incomodam o usuário.
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

import { useUpdateToast } from './use-update-toast';

function installApi() {
  const statusCallbacks: Array<(status: UpdateStatus) => void> = [];
  const infoCallbacks: Array<(info: UpdateInfo) => void> = [];
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  function subscribe<T>(bucket: Array<(value: T) => void>) {
    return vi.fn((cb: (value: T) => void) => {
      bucket.push(cb);
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    });
  }

  const api = {
    onUpdateStatus: subscribe(statusCallbacks),
    onUpdateInfo: subscribe(infoCallbacks),
    installUpdate: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
  };

  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return { api, statusCallbacks, infoCallbacks, unsubscribes };
}

type ToastPayload = {
  type: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: string;
  sound?: boolean;
};

function lastToast(): ToastPayload {
  const calls = store.toast.mock.calls;
  return calls[calls.length - 1][0] as ToastPayload;
}

beforeEach(() => {
  store.soundEnabled = true;
  store.toast.mockClear();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useUpdateToast — status', () => {
  it('oferece instalar quando o download está pronto', () => {
    const { api, statusCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    act(() => statusCallbacks[0]('ready'));

    expect(store.toast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Atualizacao baixada!',
      description: 'Reinicie para instalar a nova versao.',
      action: expect.objectContaining({ label: 'Instalar' }),
      duration: 'long',
      sound: true,
    });

    lastToast().action?.onClick();
    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it('avisa quando a verificação falha', () => {
    const { statusCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    act(() => statusCallbacks[0]('error'));

    expect(store.toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Erro ao verificar atualizacoes',
      sound: true,
    });
  });

  it('não incomoda nos estados intermediários', () => {
    const { statusCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    for (const status of ['checking', 'available', 'not-available', 'downloading'] as const) {
      act(() => statusCallbacks[0](status));
    }

    expect(store.toast).not.toHaveBeenCalled();
  });
});

describe('useUpdateToast — nova versão', () => {
  it('oferece baixar quando há versão disponível', () => {
    const { api, infoCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    act(() => infoCallbacks[0]({ version: '2.20.0' }));

    expect(store.toast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Versao 2.20.0 disponivel',
      description: 'Uma nova versao foi encontrada.',
      action: expect.objectContaining({ label: 'Baixar' }),
      duration: 'long',
      sound: true,
    });

    lastToast().action?.onClick();
    expect(api.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('ignora update-info sem versão', () => {
    const { infoCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    act(() => infoCallbacks[0]({ version: '' }));

    expect(store.toast).not.toHaveBeenCalled();
  });

  it('propaga o som desligado', () => {
    store.soundEnabled = false;
    const { infoCallbacks } = installApi();
    renderHook(() => useUpdateToast());

    act(() => infoCallbacks[0]({ version: '2.20.0' }));

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });
});

describe('useUpdateToast — inscrições', () => {
  it('cancela as duas inscrições ao desmontar', () => {
    const { unsubscribes } = installApi();
    const { unmount } = renderHook(() => useUpdateToast());

    expect(unsubscribes).toHaveLength(2);

    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(unsubscribes[1]).toHaveBeenCalledTimes(1);
  });

  it('reassina quando a preferência de som muda', () => {
    const { statusCallbacks, unsubscribes } = installApi();
    const { rerender } = renderHook(() => useUpdateToast());

    store.soundEnabled = false;
    rerender();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(unsubscribes[1]).toHaveBeenCalledTimes(1);
    expect(statusCallbacks).toHaveLength(2);

    act(() => statusCallbacks[1]('ready'));

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });
});
