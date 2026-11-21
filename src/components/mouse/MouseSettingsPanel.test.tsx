// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MouseSettings } from '../../../electron/shared/mouse-settings';
import { MouseSettingsPanel } from './MouseSettingsPanel';

const CURRENT: MouseSettings = {
  pointerSpeed: 10,
  enhancedPrecision: true,
  doubleClickSpeed: 500,
};
const APPLIED: MouseSettings = { ...CURRENT, pointerSpeed: 16, doubleClickSpeed: 300 };

const getMouseSettings = vi.fn<() => Promise<MouseSettings>>();
const applyMouseSettings = vi.fn<(settings: MouseSettings) => Promise<MouseSettings>>();

function installApi(
  loadImpl: () => Promise<MouseSettings> = async () => ({ ...CURRENT }),
  applyImpl: (settings: MouseSettings) => Promise<MouseSettings> = async (settings) => settings
) {
  getMouseSettings.mockReset();
  getMouseSettings.mockImplementation(loadImpl);
  applyMouseSettings.mockReset();
  applyMouseSettings.mockImplementation(applyImpl);
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getMouseSettings,
    applyMouseSettings,
  };
}

function text(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('MouseSettingsPanel — estados de carga', () => {
  beforeEach(() => installApi());

  it('mostra um esqueleto enquanto lê as configurações do Windows', () => {
    const { container } = render(<MouseSettingsPanel />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(text()).not.toContain('Ajustes do Windows');
  });

  it('mostra o erro quando a leitura falha', async () => {
    installApi(async () => {
      throw new Error('registro do mouse indisponível');
    });
    render(<MouseSettingsPanel />);

    await waitFor(() => expect(text()).toContain('Erro ao carregar ajustes do mouse'));
    expect(text()).toContain('registro do mouse indisponível');
  });
});

describe('MouseSettingsPanel — controles', () => {
  beforeEach(() => installApi());

  it('mostra os três controles com os valores atuais do Windows', async () => {
    render(<MouseSettingsPanel />);

    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );
    expect(text()).toContain('Ajustes do Windows');
    expect(text()).toContain('tempo real');
    expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toHaveProperty(
      'value',
      '10'
    );
    expect(
      screen
        .getByRole('switch', { name: 'Melhorar precisão do ponteiro' })
        .getAttribute('data-state')
    ).toBe('checked');
    expect(screen.getByRole('slider', { name: 'Tempo de duplo clique' })).toHaveProperty(
      'value',
      '500'
    );
  });

  it('mostra a prévia antes dos controles e as ações depois', async () => {
    render(<MouseSettingsPanel />);
    const preview = await screen.findByRole('img', { name: 'Prévia do rastro do mouse' });
    const slider = screen.getByRole('slider', { name: 'Velocidade do ponteiro' });
    const apply = screen.getByRole('button', { name: 'Aplicar' });

    expect(preview.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slider.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('usa o selo tempo real e remove as escalas dos sliders', async () => {
    render(<MouseSettingsPanel />);
    await screen.findByRole('slider', { name: 'Velocidade do ponteiro' });

    expect(screen.getByText('tempo real')).toBeTruthy();
    expect(screen.queryByText('valores atuais')).toBeNull();
    expect(screen.queryByText('Lento')).toBeNull();
    expect(screen.queryByText('Rápido')).toBeNull();
  });

  it('só habilita Aplicar quando há uma alteração pendente', async () => {
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    const apply = screen.getByRole('button', { name: 'Aplicar' });
    expect(apply).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade do ponteiro' }), {
      target: { value: '16' },
    });

    expect(apply).toHaveProperty('disabled', false);
    expect(text()).toContain('16 / 20');
  });

  it('anima a velocidade do ponteiro quando o slider muda', async () => {
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade do ponteiro' }), {
      target: { value: '16' },
    });

    expect(screen.getByText('16 / 20').className).toContain('sr-only');
  });

  it('aplica velocidade e tempo de duplo clique com os valores escolhidos', async () => {
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade do ponteiro' }), {
      target: { value: '16' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo de duplo clique' }), {
      target: { value: '300' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(applyMouseSettings).toHaveBeenCalledWith(APPLIED));
    await waitFor(() => expect(text()).toContain('Ajustes aplicados'));
  });

  it('desliga a precisão quando o usuário alterna o interruptor', async () => {
    render(<MouseSettingsPanel />);
    const toggle = await screen.findByRole('switch', { name: 'Melhorar precisão do ponteiro' });

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(applyMouseSettings).toHaveBeenCalledWith({
        ...CURRENT,
        enhancedPrecision: false,
      })
    );
  });

  it('restaura os padrões do Windows e aplica na hora', async () => {
    installApi(async () => ({ pointerSpeed: 19, enhancedPrecision: false, doubleClickSpeed: 900 }));
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));

    await waitFor(() => expect(applyMouseSettings).toHaveBeenCalledWith(CURRENT));
    expect(text()).toContain('Ajustes aplicados');
  });

  it('descarta a alteração pendente ao clicar em Cancelar alterações', async () => {
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade do ponteiro' }), {
      target: { value: '18' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alterações' }));

    expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toHaveProperty(
      'value',
      '10'
    );
    expect(applyMouseSettings).not.toHaveBeenCalled();
  });

  it('exibe a falha de gravação e mantém o botão Aplicar disponível', async () => {
    installApi(undefined, async () => {
      throw new Error('acesso negado');
    });
    render(<MouseSettingsPanel />);
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: 'Velocidade do ponteiro' })).toBeTruthy()
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Velocidade do ponteiro' }), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(text()).toContain('Não foi possível aplicar os ajustes'));
    expect(text()).toContain('acesso negado');
    expect(screen.getByRole('button', { name: 'Aplicar' })).toHaveProperty('disabled', false);
  });
});
