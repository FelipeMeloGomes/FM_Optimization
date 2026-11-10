// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../electron/shared/ipc-types';

/**
 * Regressão das preferências de execução.
 *
 * Confirmação e ponto de restauração são flags separadas. Um clique no toggle
 * de confirmação não pode gravar o estado do restore point junto: o usuário
 * perderia a outra preferência sem perceber.
 */

const state = vi.hoisted(() => ({
  settings: {} as Partial<AppSettings>,
  update: vi.fn(),
  exportData: vi.fn(async () => {}),
  importData: vi.fn(async (_file: File) => {}),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: state.settings as AppSettings,
    update: state.update,
    loading: false,
    exportData: state.exportData,
    importData: state.importData,
  }),
}));

import { PreferencesSection } from './PreferencesSection';

beforeEach(() => {
  state.settings = { confirmOnExecute: true, autoRestorePoint: true };
  state.update.mockClear();
});

describe('PreferencesSection', () => {
  it('renderiza os dois toggles com o estado salvo', () => {
    state.settings = { confirmOnExecute: true, autoRestorePoint: false };
    render(<PreferencesSection />);

    expect(screen.getByText('Preferencias')).not.toBeNull();
    expect(screen.getByLabelText('Confirmar Execucao').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Restore Point Automatico').getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('desliga a confirmação antes de executar', () => {
    render(<PreferencesSection />);

    fireEvent.click(screen.getByLabelText('Confirmar Execucao'));

    expect(state.update).toHaveBeenCalledWith({ confirmOnExecute: false });
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it('desliga o ponto de restauração automático', () => {
    render(<PreferencesSection />);

    fireEvent.click(screen.getByLabelText('Restore Point Automatico'));

    expect(state.update).toHaveBeenCalledWith({ autoRestorePoint: false });
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it('religa cada opção a partir do estado desligado', () => {
    state.settings = { confirmOnExecute: false, autoRestorePoint: false };
    render(<PreferencesSection />);

    fireEvent.click(screen.getByLabelText('Confirmar Execucao'));
    fireEvent.click(screen.getByLabelText('Restore Point Automatico'));

    expect(state.update).toHaveBeenNthCalledWith(1, { confirmOnExecute: true });
    expect(state.update).toHaveBeenNthCalledWith(2, { autoRestorePoint: true });
  });
});
