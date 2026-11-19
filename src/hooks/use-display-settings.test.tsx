// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApplyDisplaySettingsPayload,
  DisplaySettings,
} from '../../electron/shared/display-settings';
import { useDisplaySettings } from './use-display-settings';

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
      ],
    },
    {
      deviceName: DEVICE_TWO,
      label: 'Monitor 2',
      isPrimary: false,
      width: 1440,
      height: 900,
      frequency: 60,
      modes: [{ width: 1440, height: 900, frequency: 60 }],
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

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useDisplaySettings — carga', () => {
  beforeEach(() => installApi());

  it('carrega os dois monitores com seus modos atuais', async () => {
    const { result } = renderHook(() => useDisplaySettings());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.monitors).toHaveLength(2);
    expect(result.current.drafts[DEVICE_ONE]).toEqual({
      width: 1920,
      height: 1080,
      frequency: 180,
    });
    expect(result.current.drafts[DEVICE_TWO]).toEqual({
      width: 1440,
      height: 900,
      frequency: 60,
    });
    expect(result.current.isDirty(DEVICE_ONE)).toBe(false);
  });

  it('exibe o erro quando a leitura falha', async () => {
    installApi(async () => {
      throw new Error('monitor não encontrado');
    });
    const { result } = renderHook(() => useDisplaySettings());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.status === 'error' && result.current.state.error).toBe(
      'monitor não encontrado'
    );
  });
});

describe('useDisplaySettings — edição por monitor', () => {
  beforeEach(() => installApi());

  it('edita um monitor sem afetar o outro', async () => {
    const { result } = renderHook(() => useDisplaySettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update(DEVICE_ONE, { frequency: 60 }));

    expect(result.current.drafts[DEVICE_ONE].frequency).toBe(60);
    expect(result.current.drafts[DEVICE_TWO].frequency).toBe(60);
    expect(result.current.isDirty(DEVICE_ONE)).toBe(true);
    expect(result.current.isDirty(DEVICE_TWO)).toBe(false);
    expect(applyDisplaySettings).not.toHaveBeenCalled();
  });

  it('aplica o modo apenas no monitor escolhido', async () => {
    const changed: DisplaySettings = {
      monitors: CURRENT.monitors.map((monitor) =>
        monitor.deviceName === DEVICE_ONE ? { ...monitor, frequency: 60 } : monitor
      ),
    };
    applyDisplaySettings.mockResolvedValue(changed);
    const { result } = renderHook(() => useDisplaySettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update(DEVICE_ONE, { frequency: 60 }));
    await act(async () => {
      await result.current.apply(DEVICE_ONE);
    });

    expect(applyDisplaySettings).toHaveBeenCalledWith({
      deviceName: DEVICE_ONE,
      mode: { width: 1920, height: 1080, frequency: 60 },
    });
    expect(result.current.isDirty(DEVICE_ONE)).toBe(false);
    expect(result.current.applied[DEVICE_ONE]).toBe(true);
  });

  it('desfaz a edição voltando ao modo atual do monitor', async () => {
    const { result } = renderHook(() => useDisplaySettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update(DEVICE_TWO, { width: 1920, height: 1080 }));
    expect(result.current.isDirty(DEVICE_TWO)).toBe(true);

    act(() => result.current.discard(DEVICE_TWO));
    expect(result.current.drafts[DEVICE_TWO]).toEqual({
      width: 1440,
      height: 900,
      frequency: 60,
    });
    expect(result.current.isDirty(DEVICE_TWO)).toBe(false);
  });

  it('mostra o erro apenas no monitor que falhou', async () => {
    applyDisplaySettings.mockRejectedValue(new Error('O Windows recusou o modo'));
    const { result } = renderHook(() => useDisplaySettings());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.update(DEVICE_TWO, { frequency: 120 }));
    await act(async () => {
      await result.current.apply(DEVICE_TWO);
    });

    expect(result.current.errors[DEVICE_TWO]).toBe('O Windows recusou o modo');
    expect(result.current.errors[DEVICE_ONE]).toBeUndefined();
  });
});
