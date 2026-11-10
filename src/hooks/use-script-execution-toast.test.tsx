// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEnded } from '../../electron/shared/ipc-types';

/**
 * O toast de execução só aparece quando o processo terminou com código 0 e o
 * main informou o nome do script; erros e cancelamentos ficam silenciosos (a
 * própria saída do script já é mostrada na página).
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

import { useScriptExecutionToast } from './use-script-execution-toast';

function installApi() {
  const callbacks: Array<(data: ScriptEnded) => void> = [];
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  const api = {
    onScriptEnded: vi.fn((cb: (data: ScriptEnded) => void) => {
      callbacks.push(cb);
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    }),
  };

  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return { api, callbacks, unsubscribes };
}

beforeEach(() => {
  store.soundEnabled = true;
  store.toast.mockClear();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useScriptExecutionToast', () => {
  it('avisa quando o tweak termina com sucesso', () => {
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: 0, scriptName: 'Desativar telemetria' }));

    expect(store.toast).toHaveBeenCalledTimes(1);
    expect(store.toast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Tweak executado',
      description: 'Desativar telemetria',
      duration: 'medium',
      sound: true,
    });
  });

  it('não avisa quando o exit code é diferente de zero', () => {
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: 1, scriptName: 'Desativar telemetria' }));

    expect(store.toast).not.toHaveBeenCalled();
  });

  it('não avisa quando o processo não devolveu código', () => {
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: null, scriptName: 'Desativar telemetria' }));

    expect(store.toast).not.toHaveBeenCalled();
  });

  it('não avisa quando o main não manda o nome do script', () => {
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: 0 }));

    expect(store.toast).not.toHaveBeenCalled();
  });

  it('não avisa quando o nome vem vazio', () => {
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: 0, scriptName: '' }));

    expect(store.toast).not.toHaveBeenCalled();
  });

  it('propaga o som desligado', () => {
    store.soundEnabled = false;
    const { callbacks } = installApi();
    renderHook(() => useScriptExecutionToast());

    act(() => callbacks[0]({ id: 'cpu-1', code: 0, scriptName: 'Desativar telemetria' }));

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });

  it('cancela a inscrição ao desmontar', () => {
    const { unsubscribes } = installApi();
    const { unmount } = renderHook(() => useScriptExecutionToast());

    expect(unsubscribes).toHaveLength(1);

    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it('reassina quando a preferência de som muda', () => {
    const { callbacks, unsubscribes } = installApi();
    const { rerender } = renderHook(() => useScriptExecutionToast());

    store.soundEnabled = false;
    rerender();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(2);

    act(() => callbacks[1]({ id: 'cpu-1', code: 0, scriptName: 'Desativar telemetria' }));

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });
});
