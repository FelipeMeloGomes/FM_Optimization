// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../electron/shared/ipc-types';

const state = vi.hoisted(() => ({
  settings: {} as Partial<AppSettings>,
  update: vi.fn(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: state.settings as AppSettings,
    update: state.update,
    loading: false,
    exportData: vi.fn(),
    importData: vi.fn(),
  }),
}));

import { NotificationsSection } from './NotificationsSection';

beforeEach(() => {
  state.settings = { soundEnabled: true, toastDuration: 'medium' };
  state.update.mockClear();
});

describe('NotificationsSection', () => {
  it('oferece o som e as três durações de toast', () => {
    render(<NotificationsSection />);

    expect(screen.getByText('Notificacoes')).not.toBeNull();
    expect(screen.getByText('Som nas notificacoes')).not.toBeNull();
    expect(screen.getByText('Duracao dos toasts')).not.toBeNull();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Curta (2s)', 'Media (4s)', 'Longa (8s)']);
  });

  it('atualiza apenas soundEnabled ao alternar o som', () => {
    render(<NotificationsSection />);

    fireEvent.click(screen.getByRole('switch', { name: 'Som nas notificacoes' }));

    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.update).toHaveBeenCalledWith({ soundEnabled: false });
  });

  it('atualiza apenas toastDuration ao escolher outra duração', () => {
    render(<NotificationsSection />);

    fireEvent.change(screen.getByLabelText('Duracao dos toasts'), {
      target: { value: 'long' },
    });

    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.update).toHaveBeenCalledWith({ toastDuration: 'long' });
  });
});
