// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApplyDisplaySettingsPayload,
  DisplaySettings,
} from '../../../electron/shared/display-settings';
import { DisplaySettingsPanel } from './DisplaySettingsPanel';

const DEVICE_ONE = '\\\\.\\DISPLAY1';
const DEVICE_TWO = '\\\\.\\DISPLAY2';

const CURRENT: DisplaySettings = {
  monitors: [
    {
      deviceName: DEVICE_ONE,
      label: 'Monitor 1',
      isPrimary: true,
      width: 1920,
      height: 1080,
      frequency: 180,
      modes: [
        { width: 1920, height: 1080, frequency: 180 },
        { width: 1920, height: 1080, frequency: 60 },
        { width: 1280, height: 720, frequency: 144 },
        { width: 1280, height: 720, frequency: 60 },
      ],
    },
    {
      deviceName: DEVICE_TWO,
      label: 'Monitor 2',
      isPrimary: false,
      width: 1440,
      height: 900,
      frequency: 60,
      modes: [
        { width: 1440, height: 900, frequency: 60 },
        { width: 1280, height: 720, frequency: 75 },
      ],
    },
  ],
};

const getDisplaySettings = vi.fn<() => Promise<DisplaySettings>>();
const applyDisplaySettings =
  vi.fn<(payload: ApplyDisplaySettingsPayload) => Promise<DisplaySettings>>();

function installApi(
  loadImpl: () => Promise<DisplaySettings> = async () => ({ ...CURRENT }),
  applyImpl: (payload: ApplyDisplaySettingsPayload) => Promise<DisplaySettings> = async () => ({
    ...CURRENT,
  })
) {
  getDisplaySettings.mockReset();
  getDisplaySettings.mockImplementation(loadImpl);
  applyDisplaySettings.mockReset();
  applyDisplaySettings.mockImplementation(applyImpl);
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getDisplaySettings,
    applyDisplaySettings,
  };
}

function text(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('DisplaySettingsPanel — estados de carga', () => {
  beforeEach(() => installApi());

  it('mostra um esqueleto enquanto lê as configurações do Windows', () => {
    const { container } = render(<DisplaySettingsPanel />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(text()).not.toContain('Ajustes do Windows');
  });

  it('mostra o erro quando a leitura falha', async () => {
    installApi(async () => {
      throw new Error('monitor não encontrado');
    });
    render(<DisplaySettingsPanel />);

    await waitFor(() => expect(text()).toContain('Erro ao carregar ajustes do monitor'));
    expect(text()).toContain('monitor não encontrado');
  });
});

describe('DisplaySettingsPanel — dois monitores', () => {
  beforeEach(() => installApi());

  it('lista os dois monitores com seus modos atuais', async () => {
    render(<DisplaySettingsPanel />);

    await waitFor(() => expect(screen.getByText('Ajustes do Windows')).toBeTruthy());
    expect(text()).toContain('Monitor 1');
    expect(text()).toContain('Principal');
    expect(text()).toContain('Monitor 2');
    expect(text()).toContain('1920 × 1080');
    expect(text()).toContain('1440 × 900');
    expect(screen.getAllByRole('combobox', { name: 'Resolução' })).toHaveLength(2);
    expect(screen.getAllByRole('combobox', { name: 'Taxa de atualização' })).toHaveLength(2);
  });

  it('mostra apenas as taxas disponíveis para a resolução escolhida', async () => {
    render(<DisplaySettingsPanel />);
    await waitFor(() => expect(screen.getByText('Ajustes do Windows')).toBeTruthy());

    const [resolution] = screen.getAllByRole('combobox', { name: 'Resolução' });
    fireEvent.change(resolution, { target: { value: '1280x720' } });

    const [hz] = screen.getAllByRole('combobox', { name: 'Taxa de atualização' });
    expect(Array.from(hz.querySelectorAll('option')).map((option) => option.value)).toEqual([
      '144',
      '60',
    ]);
    expect(hz).toHaveProperty('value', '144');
    expect(applyDisplaySettings).not.toHaveBeenCalled();
    expect(screen.getAllByRole('combobox', { name: 'Resolução' })[1]).toHaveProperty(
      'value',
      '1440x900'
    );
  });

  it('aplica o modo apenas no monitor escolhido', async () => {
    const changed: DisplaySettings = {
      monitors: CURRENT.monitors.map((monitor) =>
        monitor.deviceName === DEVICE_TWO
          ? { ...monitor, width: 1280, height: 720, frequency: 75 }
          : monitor
      ),
    };
    applyDisplaySettings.mockResolvedValue(changed);
    render(<DisplaySettingsPanel />);
    await waitFor(() => expect(screen.getByText('Ajustes do Windows')).toBeTruthy());

    const [, resolution] = screen.getAllByRole('combobox', { name: 'Resolução' });
    fireEvent.change(resolution, { target: { value: '1280x720' } });
    const applyButtons = screen.getAllByRole('button', { name: 'Aplicar' });
    expect(applyButtons[0]).toHaveProperty('disabled', true);
    expect(applyButtons[1]).toHaveProperty('disabled', false);
    fireEvent.click(applyButtons[1]);

    await waitFor(() =>
      expect(applyDisplaySettings).toHaveBeenCalledWith({
        deviceName: DEVICE_TWO,
        mode: { width: 1280, height: 720, frequency: 75 },
      })
    );
    expect(text()).toContain('Ajustes aplicados');
  });

  it('desfaz a escolha voltando ao modo atual daquele monitor', async () => {
    render(<DisplaySettingsPanel />);
    await waitFor(() => expect(screen.getByText('Ajustes do Windows')).toBeTruthy());

    const [resolution] = screen.getAllByRole('combobox', { name: 'Resolução' });
    fireEvent.change(resolution, { target: { value: '1280x720' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar alterações' })[0]);

    expect(screen.getAllByRole('combobox', { name: 'Resolução' })[0]).toHaveProperty(
      'value',
      '1920x1080'
    );
    expect(screen.getAllByRole('combobox', { name: 'Taxa de atualização' })[0]).toHaveProperty(
      'value',
      '180'
    );
    expect(applyDisplaySettings).not.toHaveBeenCalled();
  });

  it('mostra o erro no monitor que falhou', async () => {
    applyDisplaySettings.mockRejectedValue(new Error('O Windows recusou o modo'));
    render(<DisplaySettingsPanel />);
    await waitFor(() => expect(screen.getByText('Ajustes do Windows')).toBeTruthy());

    const [, hz] = screen.getAllByRole('combobox', { name: 'Taxa de atualização' });
    fireEvent.change(hz, { target: { value: '75' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Aplicar' })[1]);

    await waitFor(() => expect(text()).toContain('O Windows recusou o modo'));
  });
});
