import { describe, expect, it } from 'vitest';
import { IpcSchemas, validateIpcInput } from '../validation';

const OVERLAY_CHANNELS = [
  'get-overlay-games',
  'add-overlay-game',
  'remove-overlay-game',
  'set-overlay-game-enabled',
  'get-overlay-settings',
  'save-overlay-settings',
  'get-overlay-status',
  'start-overlay-monitor',
  'stop-overlay-monitor',
  'restart-overlay-elevated',
  'choose-overlay-exe',
  'get-game-display-mode',
  'set-game-borderless',
];

describe('schemas IPC do overlay', () => {
  it.each(OVERLAY_CHANNELS)('registra validação para %s', (channel) => {
    expect(IpcSchemas[channel]).toBeDefined();
  });

  it('aceita um caminho de executável absoluto ao adicionar jogo', () => {
    expect(validateIpcInput('add-overlay-game', { exePath: 'C:\\Jogos\\cs2.exe' }).success).toBe(
      true
    );
  });

  it('rejeita caminho relativo ao adicionar jogo', () => {
    expect(validateIpcInput('add-overlay-game', { exePath: 'cs2.exe' }).success).toBe(false);
  });

  it('aceita configurações válidas', () => {
    expect(
      validateIpcInput('save-overlay-settings', {
        hotkey: 'Ctrl+Shift+F',
        position: 'top-left',
        opacity: 0.85,
        targetFps: 60,
        onlyWhenFocused: true,
      }).success
    ).toBe(true);
  });

  it('aceita acelerador digitado em minúsculas', () => {
    expect(
      validateIpcInput('save-overlay-settings', {
        hotkey: 'ctrl+shift+f9',
        position: 'top-left',
        opacity: 0.85,
        targetFps: 60,
        onlyWhenFocused: true,
      }).success
    ).toBe(true);
  });

  it.each(['AltGraph', 'Ctrl+Alt+AltGraph', 'Dead', 'Unidentified', 'Ctrl', 'Ctrl+'])(
    'rejeita o acelerador inválido %s ao salvar',
    (hotkey) => {
      expect(
        validateIpcInput('save-overlay-settings', {
          hotkey,
          position: 'top-left',
          opacity: 0.85,
          targetFps: 60,
          onlyWhenFocused: true,
        }).success
      ).toBe(false);
    }
  );

  it('rejeita opacidade e alvo de FPS fora da faixa', () => {
    expect(
      validateIpcInput('save-overlay-settings', {
        hotkey: 'Ctrl+Shift+F',
        position: 'top-left',
        opacity: 5,
        targetFps: 60,
        onlyWhenFocused: true,
      }).success
    ).toBe(false);
    expect(
      validateIpcInput('save-overlay-settings', {
        hotkey: 'Ctrl+Shift+F',
        position: 'top-left',
        opacity: 0.8,
        targetFps: 9999,
        onlyWhenFocused: true,
      }).success
    ).toBe(false);
  });

  it('rejeita posição desconhecida', () => {
    expect(
      validateIpcInput('save-overlay-settings', {
        hotkey: 'Ctrl+Shift+F',
        position: 'meio',
        opacity: 0.8,
        targetFps: 60,
        onlyWhenFocused: true,
      }).success
    ).toBe(false);
  });

  it('valida os canais sem entrada como undefined', () => {
    for (const channel of [
      'get-overlay-games',
      'get-overlay-settings',
      'get-overlay-status',
      'start-overlay-monitor',
      'stop-overlay-monitor',
      'restart-overlay-elevated',
      'choose-overlay-exe',
    ]) {
      expect(validateIpcInput(channel, undefined).success).toBe(true);
    }
  });

  it('valida alternância e remoção de jogo', () => {
    expect(validateIpcInput('set-overlay-game-enabled', { id: 'abc', enabled: true }).success).toBe(
      true
    );
    expect(validateIpcInput('remove-overlay-game', 'abc').success).toBe(true);
  });

  it('valida o id do jogo ao consultar e trocar o modo de tela', () => {
    expect(validateIpcInput('get-game-display-mode', 'batman').success).toBe(true);
    expect(validateIpcInput('set-game-borderless', 'batman').success).toBe(true);
    expect(validateIpcInput('get-game-display-mode', '').success).toBe(false);
    expect(validateIpcInput('set-game-borderless', { id: 'batman' }).success).toBe(false);
  });

  it('valida o id do jogo ao iniciar o executável', () => {
    expect(validateIpcInput('launch-overlay-game', 'cs2').success).toBe(true);
    expect(validateIpcInput('launch-overlay-game', '').success).toBe(false);
    expect(validateIpcInput('launch-overlay-game', { id: 'cs2' }).success).toBe(false);
  });
});
