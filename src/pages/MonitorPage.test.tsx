// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplaySettings } from '../../electron/shared/display-settings';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import MonitorPage from './MonitorPage';

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

const CURRENT: DisplaySettings = {
  monitors: [
    {
      deviceName: '\\\\.\\DISPLAY1',
      label: 'Monitor 1',
      isPrimary: true,
      width: 1920,
      height: 1080,
      frequency: 180,
      modes: [{ width: 1920, height: 1080, frequency: 180 }],
    },
    {
      deviceName: '\\\\.\\DISPLAY2',
      label: 'Monitor 2',
      isPrimary: false,
      width: 1440,
      height: 900,
      frequency: 60,
      modes: [{ width: 1440, height: 900, frequency: 60 }],
    },
  ],
};

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getDisplaySettings: vi.fn(async () => ({ ...CURRENT })),
    applyDisplaySettings: vi.fn(async () => ({ ...CURRENT })),
  };
});

describe('página Monitor', () => {
  it('mostra o monitor animado e o painel de ajustes do Windows', async () => {
    const { container } = render(<MonitorPage />);

    expect(screen.getByRole('heading', { name: 'Monitor', level: 2 })).toBeTruthy();
    expect(container.querySelector('.animate-monitor-pulse')).not.toBeNull();

    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: 'Resolução' })).toHaveLength(2)
    );
    expect(screen.getByText('Ajustes do Windows')).toBeTruthy();
    expect(screen.getAllByRole('combobox', { name: 'Taxa de atualização' })).toHaveLength(2);
    expect(screen.getByText('Monitor 2')).toBeTruthy();
  });
});
