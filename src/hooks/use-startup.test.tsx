// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartupSetEnabledPayload, StartupSnapshot } from '../../electron/shared/ipc-types';

/**
 * A página de Inicialização não guarda estado otimista: cada ação devolve um
 * snapshot novo do main e é ele que substitui a tela. O teste fixa a API certa
 * por ação, o retorno booleano e os toasts de sucesso/erro.
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

import { useStartup } from './use-startup';

function snapshot(): StartupSnapshot {
  return { apps: [], tasks: [], services: [], isAdmin: true };
}

const LOADED = snapshot();
const UPDATED = snapshot();

const TOGGLE_ON: StartupSetEnabledPayload = {
  kind: 'app',
  id: 'app:registry:steam',
  enabled: true,
};
const TOGGLE_OFF: StartupSetEnabledPayload = {
  kind: 'app',
  id: 'app:registry:steam',
  enabled: false,
};

function installApi(overrides: Record<string, unknown> = {}) {
  const api = {
    startupList: vi.fn(async () => LOADED),
    startupSetEnabled: vi.fn(async () => UPDATED),
    startupStopService: vi.fn(async () => UPDATED),
    startupOpenLocation: vi.fn(async () => undefined),
    elevateApp: vi.fn(async () => undefined),
    ...overrides,
  };

  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
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

describe('useStartup — leitura', () => {
  it('carrega o snapshot do main', async () => {
    installApi();
    const { result } = renderHook(() => useStartup());

    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state).toEqual({ status: 'success', data: LOADED });
  });

  it('expõe a mensagem quando a leitura falha', async () => {
    installApi({ startupList: vi.fn(async () => Promise.reject(new Error('PowerShell falhou'))) });

    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    expect(result.current.state).toEqual({ status: 'error', error: 'PowerShell falhou' });
  });

  it('recarrega sob demanda', async () => {
    const api = installApi();
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.reload());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(api.startupList).toHaveBeenCalledTimes(2);
  });
});

describe('useStartup — ativar/desativar', () => {
  it('reativa, atualiza o snapshot e avisa', async () => {
    const api = installApi();
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.toggle(TOGGLE_ON, 'Steam');
    });

    expect(outcome).toBe(true);
    expect(api.startupSetEnabled).toHaveBeenCalledWith(TOGGLE_ON);
    expect(result.current.state).toEqual({ status: 'success', data: UPDATED });
    expect(store.toast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Steam reativado',
      description: 'Voltará a abrir com o Windows.',
      sound: true,
    });
    expect(result.current.busy[TOGGLE_ON.id]).toBeUndefined();
  });

  it('desativa com toast de aviso', async () => {
    installApi();
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.toggle(TOGGLE_OFF, 'Steam');
    });

    expect(store.toast).toHaveBeenCalledWith({
      type: 'warning',
      title: 'Steam desativado',
      description: 'Não abre mais junto com o Windows. Você pode reativar quando quiser.',
      sound: true,
    });
  });

  it('marca busy durante a chamada', async () => {
    const gate = deferred<StartupSnapshot>();
    installApi({ startupSetEnabled: vi.fn(() => gate.promise) });
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    let togglePromise!: Promise<boolean>;
    act(() => {
      togglePromise = result.current.toggle(TOGGLE_ON, 'Steam');
    });

    expect(result.current.busy[TOGGLE_ON.id]).toBe(true);

    await act(async () => {
      gate.resolve(UPDATED);
      await togglePromise;
    });

    expect(result.current.busy[TOGGLE_ON.id]).toBeUndefined();
  });

  it('devolve false e avisa quando a alteração falha', async () => {
    installApi({
      startupSetEnabled: vi.fn(async () => Promise.reject(new Error('acesso negado'))),
    });
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.toggle(TOGGLE_ON, 'Steam');
    });

    expect(outcome).toBe(false);
    expect(result.current.state).toEqual({ status: 'success', data: LOADED });
    expect(store.toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Não foi possível alterar',
      description: 'acesso negado',
    });
  });

  it('respeita o som desligado', async () => {
    store.soundEnabled = false;
    installApi();
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    await act(async () => {
      await result.current.toggle(TOGGLE_ON, 'Steam');
    });

    expect(store.toast).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
  });
});

describe('useStartup — serviço', () => {
  it('para o serviço e atualiza o snapshot', async () => {
    const api = installApi();
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.stopService('service:DiagTrack', 'DiagTrack');
    });

    expect(outcome).toBe(true);
    expect(api.startupStopService).toHaveBeenCalledWith({ id: 'service:DiagTrack' });
    expect(result.current.state).toEqual({ status: 'success', data: UPDATED });
    expect(store.toast).toHaveBeenCalledWith({
      type: 'success',
      title: 'DiagTrack parado',
      description: 'O serviço continua configurado; só foi interrompido agora.',
      sound: true,
    });
    expect(result.current.busy['service:DiagTrack']).toBeUndefined();
  });

  it('devolve false quando não consegue parar', async () => {
    installApi({
      startupStopService: vi.fn(async () => Promise.reject(new Error('serviço protegido'))),
    });
    const { result } = renderHook(() => useStartup());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.stopService('service:DiagTrack', 'DiagTrack');
    });

    expect(outcome).toBe(false);
    expect(store.toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Não foi possível parar o serviço',
      description: 'serviço protegido',
    });
  });
});

describe('useStartup — ações auxiliares', () => {
  it('abre o local do item', async () => {
    const api = installApi();
    const { result } = renderHook(() => useStartup());

    await act(async () => {
      await result.current.openLocation('app:registry:steam');
    });

    expect(api.startupOpenLocation).toHaveBeenCalledWith({ id: 'app:registry:steam' });
    expect(store.toast).not.toHaveBeenCalled();
  });

  it('avisa quando não consegue abrir o local', async () => {
    installApi({
      startupOpenLocation: vi.fn(async () => Promise.reject(new Error('pasta removida'))),
    });
    const { result } = renderHook(() => useStartup());

    await act(async () => {
      await result.current.openLocation('app:registry:steam');
    });

    expect(store.toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Não foi possível abrir o local',
      description: 'pasta removida',
    });
  });

  it('reinicia elevado pedindo UAC', async () => {
    const api = installApi();
    const { result } = renderHook(() => useStartup());

    act(() => result.current.elevate());

    expect(api.elevateApp).toHaveBeenCalledWith(undefined, undefined, undefined, true);
  });

  it('avisa quando a elevação falha', async () => {
    installApi({ elevateApp: vi.fn(async () => Promise.reject(new Error('UAC recusado'))) });
    const { result } = renderHook(() => useStartup());

    act(() => result.current.elevate());

    await waitFor(() =>
      expect(store.toast).toHaveBeenCalledWith({
        type: 'error',
        title: 'Falha ao reiniciar como administrador',
        description: 'UAC recusado',
      })
    );
  });
});
