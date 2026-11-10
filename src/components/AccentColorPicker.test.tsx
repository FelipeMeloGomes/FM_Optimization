// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../electron/shared/ipc-types';

/**
 * Regressão da seleção de cor de destaque.
 *
 * O picker só existe para chamar `update({ accentColor })` com o hex exato do
 * preset (ou da cor personalizada) e para marcar visualmente a cor salva. Se o
 * clique deixar de persistir o hex, o tema inteiro continua com a paleta
 * anterior mesmo depois de salvar.
 */

const state = vi.hoisted(() => ({
  settings: {} as Partial<AppSettings>,
  update: vi.fn(),
  exportData: vi.fn(async () => {}),
  importData: vi.fn(async (_file: File) => {}),
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: state.settings as AppSettings,
    update: state.update,
    loading: false,
    exportData: state.exportData,
    importData: state.importData,
  }),
}));

import { AccentColorPicker } from './AccentColorPicker';

function setAccent(accentColor: string) {
  state.settings = { accentColor };
}

beforeEach(() => {
  state.settings = {};
  state.update.mockClear();
  setAccent('#22d3ee');
});

describe('AccentColorPicker', () => {
  it('lista os nove presets e o seletor de cor personalizada', () => {
    render(<AccentColorPicker />);

    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getByLabelText('Cor Azul')).not.toBeNull();
    expect(screen.getByLabelText('Cor Indigo')).not.toBeNull();
    expect(screen.getByLabelText('Cor Roxo')).not.toBeNull();
    expect(screen.getByLabelText('Cor Rosa')).not.toBeNull();
    expect(screen.getByLabelText('Cor Vermelho')).not.toBeNull();
    expect(screen.getByLabelText('Cor Laranja')).not.toBeNull();
    expect(screen.getByLabelText('Cor Ambar')).not.toBeNull();
    expect(screen.getByLabelText('Cor Esmeralda')).not.toBeNull();
    expect(screen.getByLabelText('Cor Ciano')).not.toBeNull();
    expect(screen.getByLabelText('Selecionar cor personalizada')).not.toBeNull();
  });

  it('salva o hex do preset clicado', () => {
    render(<AccentColorPicker />);

    fireEvent.click(screen.getByLabelText('Cor Roxo'));
    expect(state.update).toHaveBeenCalledWith({ accentColor: '#8b5cf6' });

    fireEvent.click(screen.getByLabelText('Cor Esmeralda'));
    expect(state.update).toHaveBeenCalledWith({ accentColor: '#10b981' });
  });

  it('marca só a cor atual, ignorando maiúsculas/minúsculas do hex', () => {
    // O hex salvo pode vir em caixa alta (input type=color normaliza assim).
    setAccent('#3B82F6');
    render(<AccentColorPicker />);

    const active = screen.getByLabelText('Cor Azul');
    expect(active.classList.contains('ring-2')).toBe(true);
    expect(active.classList.contains('scale-110')).toBe(true);
    expect(active.querySelector('svg')).not.toBeNull();

    const inactive = screen.getByLabelText('Cor Indigo');
    expect(inactive.classList.contains('ring-2')).toBe(false);
    expect(inactive.querySelector('svg')).toBeNull();
  });

  it('mostra a cor atual em maiúsculas', () => {
    setAccent('#ff8800');
    render(<AccentColorPicker />);

    expect(screen.getByText('Cor atual: #FF8800')).not.toBeNull();
  });

  it('salva a cor escolhida no seletor personalizado', () => {
    render(<AccentColorPicker />);

    const input = screen.getByLabelText('Selecionar cor personalizada') as HTMLInputElement;
    expect(input.value).toBe('#22d3ee');

    fireEvent.change(input, { target: { value: '#123456' } });

    expect(state.update).toHaveBeenCalledWith({ accentColor: '#123456' });
  });
});
