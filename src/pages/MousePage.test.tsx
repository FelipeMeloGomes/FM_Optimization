// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import type { MouseSettings } from '../../electron/shared/mouse-settings';
import MousePage from './MousePage';

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

const CURRENT: MouseSettings = {
  pointerSpeed: 10,
  enhancedPrecision: true,
  doubleClickSpeed: 500,
};

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getMouseSettings: vi.fn(async () => ({ ...CURRENT })),
    applyMouseSettings: vi.fn(async (settings: MouseSettings) => settings),
  };
});

describe('página Mouse', () => {
  it('mostra o cursor animado e o painel de ajustes do Windows', async () => {
    const { container } = render(<MousePage />);

    expect(screen.getByRole('heading', { name: 'Mouse', level: 2 })).toBeTruthy();
    expect(container.querySelector('.animate-mouse-glide')).not.toBeNull();

    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );
    expect(screen.getByText('Ajustes do Windows')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Prévia do rastro do mouse' })).toBeTruthy();
  });
});
