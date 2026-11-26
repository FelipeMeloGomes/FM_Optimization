import { describe, expect, it, vi } from 'vitest';
import {
  applyDisplaySettings,
  buildApplyDisplaySettingsScript,
  buildReadDisplaySettingsScript,
  parseDisplaySettings,
  readDisplaySettings,
  validDeviceName,
} from './display-settings';

const DEVICE_ONE = '\\\\.\\DISPLAY1';
const DEVICE_TWO = '\\\\.\\DISPLAY2';

const RAW = JSON.stringify({
  monitors: [
    {
      deviceName: DEVICE_ONE,
      label: 'Monitor 1',
      isPrimary: true,
      width: 1920,
      height: 1080,
      frequency: 144,
      modes: [
        { width: 1920, height: 1080, frequency: 144 },
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
});

const CURRENT = { width: 1920, height: 1080, frequency: 144 };

describe('parseDisplaySettings', () => {
  it('converte todos os monitores ativos e seus modos', () => {
    const parsed = parseDisplaySettings(RAW);

    expect(parsed.monitors).toHaveLength(2);
    expect(parsed.monitors[0]).toEqual({
      deviceName: DEVICE_ONE,
      label: 'Monitor 1',
      isPrimary: true,
      width: 1920,
      height: 1080,
      frequency: 144,
      modes: [
        { width: 1920, height: 1080, frequency: 144 },
        { width: 1920, height: 1080, frequency: 60 },
      ],
    });
    expect(parsed.monitors[1].deviceName).toBe(DEVICE_TWO);
    expect(parsed.monitors[1].isPrimary).toBe(false);
    expect(parsed.monitors[1].modes).toHaveLength(1);
  });

  it('rejeita uma resposta sem monitores', () => {
    expect(() => parseDisplaySettings('{"monitors":[]}')).toThrow('Nenhum monitor ativo');
  });

  it('rejeita uma resolução inválida', () => {
    const raw = JSON.stringify({
      monitors: [
        {
          deviceName: DEVICE_ONE,
          label: 'Monitor 1',
          isPrimary: true,
          width: 0,
          height: 1080,
          frequency: 60,
          modes: [],
        },
      ],
    });
    expect(() => parseDisplaySettings(raw)).toThrow('Resolução');
  });

  it('rejeita uma taxa fora da faixa do Windows', () => {
    const raw = JSON.stringify({
      monitors: [
        {
          deviceName: DEVICE_ONE,
          label: 'Monitor 1',
          isPrimary: true,
          width: 1920,
          height: 1080,
          frequency: 1,
          modes: [],
        },
      ],
    });
    expect(() => parseDisplaySettings(raw)).toThrow('Taxa de atualização');
  });

  it('rejeita um nome de dispositivo inesperado', () => {
    const raw = JSON.stringify({
      monitors: [
        {
          deviceName: '"; throw "injected',
          label: 'Monitor 1',
          isPrimary: true,
          width: 1920,
          height: 1080,
          frequency: 60,
          modes: [],
        },
      ],
    });
    expect(() => parseDisplaySettings(raw)).toThrow('Monitor não identificado');
  });

  it('rejeita saída malformada', () => {
    expect(() => parseDisplaySettings('not json')).toThrow('resposta inválida');
    expect(() => parseDisplaySettings('  \n ')).toThrow(
      'Não foi possível ler as configurações do monitor: resposta inválida'
    );
  });
});

describe('validDeviceName', () => {
  it('aceita apenas \\\\.\\DISPLAYn', () => {
    expect(validDeviceName(DEVICE_ONE)).toBe(true);
    expect(validDeviceName(DEVICE_TWO)).toBe(true);
    expect(validDeviceName('DISPLAY1')).toBe(false);
    expect(validDeviceName('"; throw "x')).toBe(false);
  });
});

describe('scripts', () => {
  it('enumera todos os adaptadores ativos e seus modos', () => {
    const script = buildReadDisplaySettingsScript();
    expect(script).toContain('EnumDisplayDevices');
    expect(script).toContain('EnumDisplaySettingsEx');
    expect(script).toContain('DISPLAY_DEVICE_ATTACHED_TO_DESKTOP');
    expect(script).toContain('ConvertTo-Json');
  });

  it('aplica o modo no monitor escolhido e persiste a mudança', () => {
    const script = buildApplyDisplaySettingsScript(DEVICE_TWO, {
      width: 2560,
      height: 1440,
      frequency: 120,
    });
    expect(script).toContain('ChangeDisplaySettingsEx');
    expect(script).toContain(`$targetDevice = '${DEVICE_TWO}'`);
    expect(script).toContain('2560');
    expect(script).toContain('1440');
    expect(script).toContain('120');
    expect(script).toContain('0x40000001');
  });

  it('não interpola arquivos arbitrários no script', () => {
    expect(() => buildApplyDisplaySettingsScript('"; throw "x', CURRENT)).toThrow(
      'Monitor inválido'
    );
  });
});

describe('readDisplaySettings', () => {
  it('faz uma única chamada ao PowerShell e devolve todos os monitores', async () => {
    const exec = vi.fn(async () => RAW);

    const result = await readDisplaySettings(exec);

    expect(result.monitors).toHaveLength(2);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('applyDisplaySettings', () => {
  it('aplica no monitor escolhido e devolve a lista atualizada', async () => {
    const exec = vi.fn(async (_script: string) => RAW);

    const result = await applyDisplaySettings(
      DEVICE_TWO,
      { ...CURRENT, width: 1440, height: 900, frequency: 60 },
      exec
    );

    expect(result.monitors).toHaveLength(2);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toContain(DEVICE_TWO);
  });

  it('rejeita valores inválidos antes de chamar o PowerShell', async () => {
    const exec = vi.fn(async () => RAW);

    await expect(
      applyDisplaySettings(DEVICE_ONE, { width: 100, height: 100, frequency: 60 }, exec)
    ).rejects.toThrow('Resolução');
    expect(exec).not.toHaveBeenCalled();
  });

  it('rejeita um monitor inválido antes de chamar o PowerShell', async () => {
    const exec = vi.fn(async () => RAW);

    await expect(applyDisplaySettings('DISPLAY1', CURRENT, exec)).rejects.toThrow(
      'Monitor inválido'
    );
    expect(exec).not.toHaveBeenCalled();
  });
});
