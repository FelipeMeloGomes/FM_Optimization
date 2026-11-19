// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MOUSE_SETTINGS, type MouseSettings } from '../../electron/shared/mouse-settings';
import { useMouseSettings } from './use-mouse-settings';

const CURRENT: MouseSettings = {
  pointerSpeed: 10,
  enhancedPrecision: true,
  doubleClickSpeed: 500,
};

const getMouseSettings = vi.fn<() => Promise<MouseSettings>>();
const applyMouseSettings = vi.fn<(settings: MouseSettings) => Promise<MouseSettings>>();

function installApi(
  loadImpl: () => Promise<MouseSettings> = async () => ({ ...CURRENT }),
  applyImpl: (settings: MouseSettings) => Promise<MouseSettings> = async (settings) => settings
) {
  getMouseSettings.mockReset();
  getMouseSettings.mockImplementation(loadImpl);
  applyMouseSettings.mockReset();
  applyMouseSettings.mockImplementation(applyImpl);
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getMouseSettings,
    applyMouseSettings,
  };
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useMouseSettings — carga', () => {
  beforeEach(() => installApi());

  it('começa carregando e depois guarda os valores atuais do Windows', async () => {
    const { result } = renderHook(() => useMouseSettings());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.draft).toEqual(CURRENT);
    expect(result.current.isDirty).toBe(false);
  });

  it('exibe o erro quando o Windows não responde', async () => {
    installApi(async () => {
      throw new Error('acesso negado ao HKCU');
    });
    const { result } = renderHook(() => useMouseSettings());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.status === 'error' && result.current.state.error).toBe(
      'acesso negado ao HKCU'
    );
  });
});

describe('useMouseSettings — edição', () => {
  beforeEach(() => installApi());

  it('marca como pendente sem chamar a API até o usuário aplicar', async () => {
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 16 }));

    expect(result.current.draft?.pointerSpeed).toBe(16);
    expect(result.current.isDirty).toBe(true);
    expect(applyMouseSettings).not.toHaveBeenCalled();
  });

  it('aplica o rascunho e limpa o estado pendente', async () => {
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 16, doubleClickSpeed: 300 }));
    await act(async () => {
      await result.current.apply();
    });

    expect(applyMouseSettings).toHaveBeenCalledWith({
      pointerSpeed: 16,
      enhancedPrecision: true,
      doubleClickSpeed: 300,
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.appliedAt).not.toBeNull();
    expect(result.current.state.status === 'success' && result.current.state.data).toEqual({
      pointerSpeed: 16,
      enhancedPrecision: true,
      doubleClickSpeed: 300,
    });
  });

  it('mantém a edição pendente quando a aplicação falha', async () => {
    installApi(undefined, async () => {
      throw new Error('falha ao gravar no registro');
    });
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 4 }));
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.applyError).toBe('falha ao gravar no registro');
    expect(result.current.isDirty).toBe(true);
  });

  it('restaura os padrões do Windows como uma edição pendente', async () => {
    installApi(async () => ({ pointerSpeed: 19, enhancedPrecision: false, doubleClickSpeed: 900 }));
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.reset());

    expect(result.current.draft).toEqual(DEFAULT_MOUSE_SETTINGS);
    expect(result.current.isDirty).toBe(true);
    expect(applyMouseSettings).not.toHaveBeenCalled();
  });

  it('descarta a edição pendente voltando aos valores aplicados', async () => {
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 20, enhancedPrecision: false }));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.discard());

    expect(result.current.draft).toEqual(CURRENT);
    expect(result.current.isDirty).toBe(false);
    expect(applyMouseSettings).not.toHaveBeenCalled();
  });

  it('aplica valores explícitos sem depender do rascunho atual', async () => {
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 2 }));
    await act(async () => {
      await result.current.apply(DEFAULT_MOUSE_SETTINGS);
    });

    expect(applyMouseSettings).toHaveBeenCalledWith(DEFAULT_MOUSE_SETTINGS);
    expect(result.current.draft).toEqual(DEFAULT_MOUSE_SETTINGS);
  });

  it('recarrega os valores reais descartando a edição pendente', async () => {
    const { result } = renderHook(() => useMouseSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ pointerSpeed: 20 }));
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.draft).toEqual(CURRENT);
    expect(result.current.isDirty).toBe(false);
    expect(getMouseSettings).toHaveBeenCalledTimes(2);
  });
});
