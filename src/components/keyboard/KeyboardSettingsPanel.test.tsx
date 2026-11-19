// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_KEYBOARD_SETTINGS,
  type KeyboardSettings,
} from '../../../electron/shared/keyboard-settings';
import { KeyboardSettingsPanel } from './KeyboardSettingsPanel';

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

function text(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('KeyboardSettingsPanel — estados de carga', () => {
  beforeEach(() => installApi());

  it('mostra um esqueleto enquanto lê as configurações do Windows', () => {
    const { container } = render(<KeyboardSettingsPanel />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(text()).not.toContain('Ajustes do Windows');
  });

  it('mostra o erro quando a leitura falha', async () => {
    installApi(async () => {
      throw new Error('teclado não encontrado');
    });
    render(<KeyboardSettingsPanel />);

    await waitFor(() => expect(text()).toContain('Erro ao carregar ajustes do teclado'));
    expect(text()).toContain('teclado não encontrado');
  });
});

describe('KeyboardSettingsPanel — controles', () => {
  beforeEach(() => installApi());

  it('mostra os três controles com os valores atuais do Windows', async () => {
    render(<KeyboardSettingsPanel />);

    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );
    expect(text()).toContain('Ajustes do Windows');
    expect(text()).toContain('valores atuais');
    expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toHaveProperty('value', '0');
    expect(screen.getByRole('slider', { name: 'Velocidade de repetição' })).toHaveProperty(
      'value',
      '31'
    );
    expect(screen.getByRole('slider', { name: 'Piscagem do cursor' })).toHaveProperty(
      'value',
      '200'
    );
    expect(screen.getByRole('img', { name: 'Prévia do teclado' })).toBeTruthy();
  });

  it('só habilita Aplicar quando há alteração pendente', async () => {
    render(<KeyboardSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );

    expect(screen.getByRole('button', { name: 'Aplicar' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByRole('slider', { name: 'Piscagem do cursor' }), {
      target: { value: '700' },
    });
    expect(screen.getByRole('button', { name: 'Aplicar' })).toHaveProperty('disabled', false);
  });

  it('aplica os três ajustes', async () => {
    render(<KeyboardSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Atraso até repetir' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(applyKeyboardSettings).toHaveBeenCalledWith({
        repeatDelay: 2,
        repeatRate: 31,
        caretBlinkRate: 200,
      })
    );
    await waitFor(() => expect(text()).toContain('Ajustes aplicados'));
  });

  it('preenche e aplica os padrões do Windows', async () => {
    applyKeyboardSettings.mockResolvedValue({ ...DEFAULT_KEYBOARD_SETTINGS });
    render(<KeyboardSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));

    await waitFor(() =>
      expect(applyKeyboardSettings).toHaveBeenCalledWith(DEFAULT_KEYBOARD_SETTINGS)
    );
  });

  it('cancela as alterações e mostra erro de aplicação', async () => {
    applyKeyboardSettings.mockRejectedValue(new Error('O Windows recusou'));
    render(<KeyboardSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Atraso até repetir' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade de repetição' }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(text()).toContain('O Windows recusou'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alterações' }));
    expect(screen.getByRole('slider', { name: 'Velocidade de repetição' })).toHaveProperty(
      'value',
      '31'
    );
  });
});
