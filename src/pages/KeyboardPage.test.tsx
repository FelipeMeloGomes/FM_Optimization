// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import type { KeyboardSettings } from '../../electron/shared/keyboard-settings';
import KeyboardPage from './KeyboardPage';

const store = vi.hoisted(() => ({
  state: { status: 'success' } as AsyncState<ScriptEntry[]>,
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.state,
    categoryScripts: [],
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleConfirmExecute: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

const CURRENT: KeyboardSettings = {
  repeatDelay: 0,
  repeatRate: 31,
  caretBlinkRate: 200,
};

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getKeyboardSettings: vi.fn(async () => ({ ...CURRENT })),
    applyKeyboardSettings: vi.fn(async () => ({ ...CURRENT })),
  };
});

describe('página Teclado', () => {
  it('mostra o teclado animado e o painel de ajustes do Windows', async () => {
    const { container } = render(<KeyboardPage />);

    expect(screen.getByRole('heading', { name: 'Teclado', level: 2 })).toBeTruthy();
    expect(container.querySelector('.animate-keyboard-glow')).not.toBeNull();

    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );
    expect(screen.getByText('Ajustes do Windows')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Prévia do teclado' })).toBeTruthy();
  });
});
