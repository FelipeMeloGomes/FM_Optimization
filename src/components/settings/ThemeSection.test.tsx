// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../electron/shared/ipc-types';

/**
 * Regressão da seção de tema.
 *
 * A seção é a composição de `ThemeSelector` e `AccentColorPicker`; o teste
 * garante que os dois continuam montados e que o clique em cada card chega ao
 * mesmo `update` do contexto — um wrapper quebrado deixaria a tela de tema
 * vazia mesmo com os componentes isolados funcionando.
 */

// `theme-config` importa o BatmanBackground, que instancia `Path2D` no topo do
// módulo — API de canvas que o jsdom não implementa.
vi.mock('../BatmanBackground', () => ({ BatmanBackground: () => null }));

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

import { ThemeSection } from './ThemeSection';

beforeEach(() => {
  state.settings = { theme: 'dark', accentColor: '#22d3ee' };
  state.update.mockClear();
});

describe('ThemeSection', () => {
  it('renderiza as duas áreas da seção', () => {
    render(<ThemeSection />);

    expect(screen.getByText('Tema')).not.toBeNull();
    expect(screen.getByText('Aparencia')).not.toBeNull();
    expect(screen.getByText('Escolha o visual do FM Optimize')).not.toBeNull();
    expect(screen.getByText('Cor de destaque')).not.toBeNull();
    expect(screen.getByText('Personalize a cor principal da interface')).not.toBeNull();
  });

  it('monta o seletor de temas e o picker de cor', () => {
    render(<ThemeSection />);

    expect(screen.getAllByRole('button')).toHaveLength(6 + 9);
    expect(screen.getByLabelText('Tema Terminal (ativo)')).not.toBeNull();
    expect(screen.getByLabelText('Cor Ciano')).not.toBeNull();
    expect(screen.getByLabelText('Selecionar cor personalizada')).not.toBeNull();
  });

  it('persiste o tema e a cor escolhidos', () => {
    render(<ThemeSection />);

    fireEvent.click(screen.getByLabelText('Tema Gotham Noir'));
    expect(state.update).toHaveBeenCalledWith({ theme: 'batman' });

    fireEvent.click(screen.getByLabelText('Cor Vermelho'));
    expect(state.update).toHaveBeenCalledWith({ accentColor: '#ef4444' });
  });
});
