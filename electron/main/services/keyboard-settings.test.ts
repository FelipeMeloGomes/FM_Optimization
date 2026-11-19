import { describe, expect, it, vi } from 'vitest';
import {
  applyKeyboardSettings,
  buildApplyKeyboardSettingsScript,
  buildReadKeyboardSettingsScript,
  parseKeyboardSettings,
  readKeyboardSettings,
  validateKeyboardSettings,
} from './keyboard-settings';

const RAW = '{"repeatDelay":0,"repeatRate":31,"caretBlinkRate":200}';

const CURRENT = { repeatDelay: 0, repeatRate: 31, caretBlinkRate: 200 };

describe('parseKeyboardSettings', () => {
  it('converte os valores informados pelo Windows', () => {
    expect(parseKeyboardSettings(RAW)).toEqual(CURRENT);
  });

  it('rejeita atraso de repetição fora de 0–3', () => {
    expect(() =>
      parseKeyboardSettings('{"repeatDelay":9,"repeatRate":31,"caretBlinkRate":200}')
    ).toThrow('Atraso');
  });

  it('rejeita taxa de repetição fora de 0–31', () => {
    expect(() =>
      parseKeyboardSettings('{"repeatDelay":0,"repeatRate":50,"caretBlinkRate":200}')
    ).toThrow('Repetição');
  });

  it('rejeita piscagem fora da faixa', () => {
    expect(() =>
      parseKeyboardSettings('{"repeatDelay":0,"repeatRate":31,"caretBlinkRate":1}')
    ).toThrow('Piscagem');
  });

  it('rejeita saída malformada', () => {
    expect(() => parseKeyboardSettings('not json')).toThrow('resposta inválida');
  });

  it('rejeita campos ausentes', () => {
    expect(() => parseKeyboardSettings('{"repeatDelay":0}')).toThrow('inválidas');
  });
});

describe('validateKeyboardSettings', () => {
  it('aceita valores válidos e rejeita strings', () => {
    expect(validateKeyboardSettings(CURRENT)).toEqual(CURRENT);
    expect(() => validateKeyboardSettings({ ...CURRENT, repeatRate: '31' })).toThrow('Repetição');
  });
});

describe('scripts', () => {
  it('lê atraso, velocidade e piscagem com uma única chamada', () => {
    const script = buildReadKeyboardSettingsScript();
    expect(script).toContain('0x0016');
    expect(script).toContain('0x000A');
    expect(script).toContain('GetCaretBlinkTime');
    expect(script).toContain('ConvertTo-Json');
  });

  it('aplica os três ajustes e salva a piscagem no registro', () => {
    const script = buildApplyKeyboardSettingsScript({
      repeatDelay: 2,
      repeatRate: 12,
      caretBlinkRate: 700,
    });
    expect(script).toContain('0x0017');
    expect(script).toContain('0x000B');
    expect(script).toContain('SetCaretBlinkTime');
    expect(script).toContain('CursorBlinkRate');
    expect(script).toContain('700');
    expect(script).toContain('0x3');
  });

  it('não interpola texto arbitrário no script', () => {
    const script = buildApplyKeyboardSettingsScript(CURRENT);
    expect(script).not.toContain(';throw');
  });
});

describe('readKeyboardSettings', () => {
  it('faz uma única chamada ao PowerShell', async () => {
    const exec = vi.fn(async () => RAW);

    await expect(readKeyboardSettings(exec)).resolves.toEqual(CURRENT);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('applyKeyboardSettings', () => {
  it('aplica e devolve os valores informados pelo Windows', async () => {
    const exec = vi.fn(async () => RAW);

    await expect(applyKeyboardSettings({ ...CURRENT, repeatDelay: 2 }, exec)).resolves.toEqual(
      CURRENT
    );
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('rejeita valores inválidos antes de chamar o PowerShell', async () => {
    const exec = vi.fn(async () => RAW);

    await expect(applyKeyboardSettings({ ...CURRENT, repeatRate: 99 }, exec)).rejects.toThrow(
      'Repetição'
    );
    expect(exec).not.toHaveBeenCalled();
  });
});
