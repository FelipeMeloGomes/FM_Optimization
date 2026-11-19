// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_KEYBOARD_SETTINGS,
  type KeyboardSettings,
} from '../../electron/shared/keyboard-settings';
import { useKeyboardSettings } from './use-keyboard-settings';

const CURRENT: KeyboardSettings = {
  repeatDelay: 0,
  repeatRate: 31,
  caretBlinkRate: 200,
};

const getKeyboardSettings = vi.fn<() => Promise<KeyboardSettings>>();
const applyKeyboardSettings = vi.fn<(settings: KeyboardSettings) => Promise<KeyboardSettings>>();

function installApi(
  loadImpl: () => Promise<KeyboardSettings> = async () => ({ ...CURRENT }),
  applyImpl: (settings: KeyboardSettings) => Promise<KeyboardSettings> = async (settings) =>
    settings
) {
  getKeyboardSettings.mockReset();
  getKeyboardSettings.mockImplementation(loadImpl);
  applyKeyboardSettings.mockReset();
  applyKeyboardSettings.mockImplementation(applyImpl);
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getKeyboardSettings,
    applyKeyboardSettings,
  };
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useKeyboardSettings — carga', () => {
  beforeEach(() => installApi());

  it('carrega os valores atuais do Windows', async () => {
    const { result } = renderHook(() => useKeyboardSettings());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.draft).toEqual(CURRENT);
    expect(result.current.isDirty).toBe(false);
  });

  it('mostra o erro quando a leitura falha', async () => {
    installApi(async () => {
      throw new Error('teclado não encontrado');
    });
    const { result } = renderHook(() => useKeyboardSettings());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.status === 'error' && result.current.state.error).toBe(
      'teclado não encontrado'
    );
  });
});

describe('useKeyboardSettings — edição', () => {
  beforeEach(() => installApi());

  it('edita o rascunho sem aplicar ao Windows', async () => {
    const { result } = renderHook(() => useKeyboardSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ caretBlinkRate: 700 }));

    expect(result.current.draft?.caretBlinkRate).toBe(700);
    expect(result.current.isDirty).toBe(true);
    expect(applyKeyboardSettings).not.toHaveBeenCalled();
  });

  it('aplica os três ajustes e usa o retorno do Windows', async () => {
    const applied: KeyboardSettings = { ...CURRENT, repeatDelay: 2, repeatRate: 12 };
    applyKeyboardSettings.mockResolvedValue(applied);
    const { result } = renderHook(() => useKeyboardSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ repeatDelay: 2, repeatRate: 12 }));
    await act(async () => {
      await result.current.apply();
    });

    expect(applyKeyboardSettings).toHaveBeenCalledWith({
      repeatDelay: 2,
      repeatRate: 12,
      caretBlinkRate: 200,
    });
    expect(result.current.draft).toEqual(applied);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.appliedAt).not.toBeNull();
  });

  it('preenche com os padrões sem aplicar', async () => {
    const { result } = renderHook(() => useKeyboardSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.reset());

    expect(result.current.draft).toEqual(DEFAULT_KEYBOARD_SETTINGS);
    expect(result.current.isDirty).toBe(true);
    expect(applyKeyboardSettings).not.toHaveBeenCalled();
  });

  it('desfaz as alterações e mostra erro de aplicação', async () => {
    applyKeyboardSettings.mockRejectedValue(new Error('O Windows recusou'));
    const { result } = renderHook(() => useKeyboardSettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update({ repeatRate: 5 }));
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.applyError).toBe('O Windows recusou');

    act(() => result.current.discard());
    expect(result.current.draft).toEqual(CURRENT);
    expect(result.current.applyError).toBeNull();
  });
});
