import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
}));

vi.mock('node:fs', () => ({
  existsSync: (p: string) => mocks.files.has(p),
  mkdirSync: vi.fn(),
  readFileSync: (p: string) => mocks.files.get(p) ?? '',
  writeFileSync: (p: string, c: string) => {
    mocks.files.set(p, c);
  },
  renameSync: (from: string, to: string) => {
    const content = mocks.files.get(from);
    if (content !== undefined) {
      mocks.files.set(to, content);
      mocks.files.delete(from);
    }
  },
}));

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => 'C:\\UserData' },
}));

import { DEFAULT_OVERLAY_SETTINGS } from '../../shared/overlay-types';
import {
  addOverlayGame,
  gameId,
  getOverlayGames,
  getOverlaySettings,
  inferGameName,
  removeOverlayGame,
  saveOverlaySettings,
  setOverlayGameEnabled,
} from '../services/overlay-storage';

beforeEach(() => {
  mocks.files.clear();
});

describe('overlay-storage', () => {
  it('gera id estável e infere o nome da pasta do executável', () => {
    expect(gameId('C:\\Jogos\\CS2\\cs2.exe')).toBe(gameId('c:\\jogos\\cs2\\CS2.exe'));
    expect(inferGameName('C:\\Jogos\\Cyberpunk 2077\\bin\\Cyberpunk2077.exe')).toBe(
      'Cyberpunk 2077'
    );
    expect(inferGameName('C:\\Jogos\\CS2\\cs2.exe')).toBe('CS2');
  });

  it('adiciona uma vez, preenche campos e alterna o habilitado', () => {
    const game = addOverlayGame({ exePath: 'C:\\Jogos\\CS2\\cs2.exe' });
    expect(game.processName).toBe('cs2.exe');
    expect(game.name).toBe('CS2');
    expect(game.coverFile).toBeNull();
    expect(game.enabled).toBe(true);
    expect(addOverlayGame({ exePath: 'c:\\jogos\\cs2\\CS2.exe' }).id).toBe(game.id);
    expect(getOverlayGames()).toHaveLength(1);

    setOverlayGameEnabled(game.id, false);
    expect(getOverlayGames()[0].enabled).toBe(false);
  });

  it('remove um jogo', () => {
    const game = addOverlayGame({ exePath: 'C:\\Jogos\\CS2\\cs2.exe' });
    removeOverlayGame(game.id);
    expect(getOverlayGames()).toHaveLength(0);
  });

  it('persiste configurações padrão e sobrescreve valores', () => {
    expect(getOverlaySettings()).toEqual(DEFAULT_OVERLAY_SETTINGS);
    saveOverlaySettings({ ...DEFAULT_OVERLAY_SETTINGS, targetFps: 144, hotkey: 'F9' });
    expect(getOverlaySettings()).toMatchObject({ targetFps: 144, hotkey: 'F9' });
  });

  it('substitui um atalho inválido salvo pelo padrão', () => {
    const path = 'C:\\UserData\\fm-optimize\\overlay-settings.json';
    mocks.files.set(path, JSON.stringify({ ...DEFAULT_OVERLAY_SETTINGS, hotkey: 'AltGraph' }));
    expect(getOverlaySettings().hotkey).toBe(DEFAULT_OVERLAY_SETTINGS.hotkey);
  });

  it('tolera arquivo corrompido e devolve lista vazia', () => {
    const path = 'C:\\UserData\\fm-optimize\\overlay-games.json';
    mocks.files.set(path, '{json quebrado');
    expect(getOverlayGames()).toEqual([]);
  });
});
