import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MOUSE_SETTINGS } from '../../shared/mouse-settings';
import {
  applyMouseSettings,
  buildApplyMouseSettingsScript,
  parseMouseSettings,
  readMouseSettings,
} from './mouse-settings';

const CURRENT = { pointerSpeed: 10, enhancedPrecision: true, doubleClickSpeed: 500 };

describe('parseMouseSettings', () => {
  it('converts the values reported by Windows into app settings', () => {
    expect(
      parseMouseSettings('{"pointerSpeed":12,"enhancedPrecision":true,"doubleClickSpeed":400}')
    ).toEqual({ pointerSpeed: 12, enhancedPrecision: true, doubleClickSpeed: 400 });
  });

  it('treats zero acceleration as precision disabled', () => {
    expect(
      parseMouseSettings('{"pointerSpeed":10,"enhancedPrecision":false,"doubleClickSpeed":500}')
        .enhancedPrecision
    ).toBe(false);
  });

  it('rejects a pointer speed outside the Windows 1-20 range', () => {
    expect(() =>
      parseMouseSettings('{"pointerSpeed":21,"enhancedPrecision":true,"doubleClickSpeed":500}')
    ).toThrow('Velocidade do ponteiro');
  });

  it('rejects a double-click time outside the Windows 100-5000 ms range', () => {
    expect(() =>
      parseMouseSettings('{"pointerSpeed":10,"enhancedPrecision":true,"doubleClickSpeed":50}')
    ).toThrow('Duplo clique');
  });

  it('rejects malformed output instead of returning defaults', () => {
    expect(() => parseMouseSettings('not json')).toThrow('resposta inválida');
  });
});

describe('buildApplyMouseSettingsScript', () => {
  it('sends the chosen pointer speed through SPI_SETMOUSESPEED', () => {
    const script = buildApplyMouseSettingsScript({ ...CURRENT, pointerSpeed: 17 });
    expect(script).toContain('0x0071');
    expect(script).toContain('[IntPtr]::new(17)');
  });

  it('disables acceleration with zero thresholds and speed', () => {
    const script = buildApplyMouseSettingsScript({ ...CURRENT, enhancedPrecision: false });
    expect(script).toContain('@(0,0,0)');
    expect(script).not.toContain('@(6,10,1)');
  });

  it('enables acceleration with the Windows default thresholds', () => {
    const script = buildApplyMouseSettingsScript({ ...CURRENT, enhancedPrecision: true });
    expect(script).toContain('@(6,10,1)');
  });

  it('sets the double-click time through SPI_SETDOUBLECLICKTIME', () => {
    const script = buildApplyMouseSettingsScript({ ...CURRENT, doubleClickSpeed: 650 });
    expect(script).toContain('0x0020');
    expect(script).toContain('650');
  });

  it('persists the change and broadcasts it without requiring logoff', () => {
    const script = buildApplyMouseSettingsScript(CURRENT);
    expect(script).toContain('$flags = 3');
    expect(script).toContain('user32.dll');
  });
});

describe('readMouseSettings', () => {
  it('reads the current values with a single PowerShell call', async () => {
    const exec = vi.fn(
      async () => '{"pointerSpeed":8,"enhancedPrecision":false,"doubleClickSpeed":420}'
    );

    await expect(readMouseSettings(exec)).resolves.toEqual({
      pointerSpeed: 8,
      enhancedPrecision: false,
      doubleClickSpeed: 420,
    });
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('applyMouseSettings', () => {
  it('applies the settings and returns what Windows accepted', async () => {
    const exec = vi.fn(
      async () => '{"pointerSpeed":14,"enhancedPrecision":true,"doubleClickSpeed":500}'
    );

    await expect(applyMouseSettings({ ...CURRENT, pointerSpeed: 14 }, exec)).resolves.toEqual({
      pointerSpeed: 14,
      enhancedPrecision: true,
      doubleClickSpeed: 500,
    });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid settings before spawning PowerShell', async () => {
    const exec = vi.fn(async () => '');

    await expect(
      applyMouseSettings({ ...DEFAULT_MOUSE_SETTINGS, pointerSpeed: 0 }, exec)
    ).rejects.toThrow('Velocidade do ponteiro');
    expect(exec).not.toHaveBeenCalled();
  });
});
