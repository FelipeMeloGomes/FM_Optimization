// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../electron/shared/ipc-types';

/**
 * Regressão da troca de tema.
 *
 * Cada card precisa persistir o id real do tema (não o rótulo exibido) e o card
 * ativo é o único que ganha a borda primária e o sufixo "(ativo)" no nome
 * acessível. Sem isso, o usuário clica em "Matrix" e o app salva outro tema.
 */

// `theme-config` importa o BatmanBackground, que instancia `Path2D` no topo do
// módulo — API de canvas que o jsdom não implementa.
vi.mock('./BatmanBackground', () => ({ BatmanBackground: () => null }));

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

import { ThemeSelector } from './ThemeSelector';

beforeEach(() => {
  state.settings = { theme: 'dark' };
  state.update.mockClear();
});

describe('ThemeSelector', () => {
  it('lista os seis temas disponíveis', () => {
    render(<ThemeSelector />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getByLabelText('Tema Paper')).not.toBeNull();
    expect(screen.getByLabelText('Tema Terminal (ativo)')).not.toBeNull();
    expect(screen.getByLabelText('Tema Deep Space')).not.toBeNull();
    expect(screen.getByLabelText('Tema Forge')).not.toBeNull();
    expect(screen.getByLabelText('Tema Matrix')).not.toBeNull();
    expect(screen.getByLabelText('Tema Gotham Noir')).not.toBeNull();
  });

  it('mostra nome e descrição de cada tema', () => {
    render(<ThemeSelector />);

    expect(screen.getByText('Paper')).not.toBeNull();
    expect(screen.getByText('Documentacao tecnica')).not.toBeNull();
    expect(screen.getByText('Gotham Noir')).not.toBeNull();
    expect(screen.getByText('Film noir gotico')).not.toBeNull();
  });

  it('destaca apenas o tema salvo', () => {
    state.settings = { theme: 'amber' };
    render(<ThemeSelector />);

    const active = screen.getByLabelText('Tema Forge (ativo)');
    expect(active.classList.contains('border-primary')).toBe(true);
    expect(active.classList.contains('border-border')).toBe(false);

    const inactive = screen.getByLabelText('Tema Terminal');
    expect(inactive.classList.contains('border-primary')).toBe(false);
    expect(inactive.classList.contains('border-border')).toBe(true);
  });

  it('salva o id do tema clicado', () => {
    render(<ThemeSelector />);

    fireEvent.click(screen.getByLabelText('Tema Matrix'));
    expect(state.update).toHaveBeenCalledWith({ theme: 'emerald' });

    fireEvent.click(screen.getByLabelText('Tema Gotham Noir'));
    expect(state.update).toHaveBeenCalledWith({ theme: 'batman' });
  });
});
