import { basename, dirname, resolve } from 'node:path';
import type { AddOverlayGameInput, OverlayGame, OverlaySettings } from '../../shared/overlay-types';
import { DEFAULT_OVERLAY_SETTINGS, isValidOverlayHotkey } from '../../shared/overlay-types';
import { createJsonStore } from '../utils/json-store';
import { getDataDir } from './data-service';

export { DEFAULT_OVERLAY_SETTINGS };

const GAMES_FILE = 'overlay-games.json';
const SETTINGS_FILE = 'overlay-settings.json';

/** Pastas genéricas que não identificam o jogo; sobe um nível quando encontradas. */
const GENERIC_DIRS = new Set([
  'bin',
  'binaries',
  'win64',
  'win32',
  'exe',
  'game',
  'core',
  'runtime',
  'launcher',
]);

function filePath(name: string): string {
  return resolve(getDataDir(), name);
}

function createStore<T>(name: string, fallback: T) {
  return createJsonStore<T>({ path: filePath(name), fallback, pretty: true });
}

function readJson<T>(name: string, fallback: T): T {
  return createStore(name, fallback).read();
}

function writeJson<T>(name: string, value: T): void {
  createStore(name, value).write(value);
}

/** ID estável, insensível a caixa e a barras, derivado do caminho do .exe. */
export function gameId(exePath: string): string {
  return exePath.replace(/\//g, '\\').toLowerCase();
}

/** Infere um nome legível a partir da pasta que contém o executável. */
export function inferGameName(exePath: string): string {
  let dir = dirname(exePath);
  let name = basename(dir);
  let guard = 0;
  while (GENERIC_DIRS.has(name.toLowerCase()) && guard < 3) {
    dir = dirname(dir);
    name = basename(dir);
    guard += 1;
  }
  return name || basename(exePath, '.exe');
}

export function getOverlayGames(): OverlayGame[] {
  const data = readJson<OverlayGame[]>(GAMES_FILE, []);
  return Array.isArray(data) ? data : [];
}

export function addOverlayGame(input: AddOverlayGameInput): OverlayGame {
  const games = getOverlayGames();
  const id = gameId(input.exePath);
  const existing = games.find((g) => g.id === id);
  if (existing) return existing;

  const game: OverlayGame = {
    id,
    name: inferGameName(input.exePath),
    exePath: input.exePath,
    processName: basename(input.exePath),
    coverFile: null,
    enabled: true,
  };
  games.push(game);
  writeJson(GAMES_FILE, games);
  return game;
}

export function updateOverlayGame(id: string, patch: Partial<OverlayGame>): void {
  const games = getOverlayGames();
  const index = games.findIndex((g) => g.id === id);
  if (index < 0) return;
  games[index] = { ...games[index], ...patch };
  writeJson(GAMES_FILE, games);
}

export function removeOverlayGame(id: string): void {
  writeJson(
    GAMES_FILE,
    getOverlayGames().filter((g) => g.id !== id)
  );
}

export function setOverlayGameEnabled(id: string, enabled: boolean): void {
  updateOverlayGame(id, { enabled });
}

export function getOverlaySettings(): OverlaySettings {
  const stored = readJson<Partial<OverlaySettings>>(SETTINGS_FILE, {});
  const settings = { ...DEFAULT_OVERLAY_SETTINGS, ...stored };
  // Config escrita por versão antiga (ou pelo teclado AltGr) pode conter um
  // acelerador que o Electron rejeita; nunca deixa isso chegar ao register().
  if (!isValidOverlayHotkey(settings.hotkey)) settings.hotkey = DEFAULT_OVERLAY_SETTINGS.hotkey;
  return settings;
}

export function saveOverlaySettings(settings: OverlaySettings): void {
  writeJson(SETTINGS_FILE, settings);
}
