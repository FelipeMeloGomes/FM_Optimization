import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameDisplayMode, GameDisplayModeInfo, OverlayGame } from '../../shared/overlay-types';

/** `Display_Mode` do GFXSettings da NVIDIA: 0 = janela, 1 = borderless, 2 = exclusivo. */
const DISPLAY_MODE_PATTERN = /(<OPTION\s+Name="Display_Mode"[^>]*\bValue=")(\d+)(")/i;

interface KnownGame {
  processName: string;
  configPath: string[];
  values: Record<string, GameDisplayMode>;
  borderlessValue: string;
}

const KNOWN_GAMES: KnownGame[] = [
  {
    processName: 'batmanak.exe',
    configPath: ['WB Games', 'Batman Arkham Knight', 'GFXSettings.BatmanArkhamKnight.xml'],
    values: { '0': 'windowed', '1': 'borderless', '2': 'exclusive' },
    borderlessValue: '1',
  },
];

export interface DisplayModeDeps {
  /** Diretório de Documentos do usuário, resolvido pelo main process. */
  documentsPath: string;
}

function knownGameFor(game: OverlayGame): KnownGame | null {
  return KNOWN_GAMES.find((known) => known.processName === game.processName.toLowerCase()) ?? null;
}

function configPath(game: OverlayGame, deps: DisplayModeDeps): string | null {
  const known = knownGameFor(game);
  return known ? join(deps.documentsPath, ...known.configPath) : null;
}

export function getGameDisplayMode(game: OverlayGame, deps: DisplayModeDeps): GameDisplayModeInfo {
  const path = configPath(game, deps);
  const known = knownGameFor(game);
  if (!path || !known || !existsSync(path)) return { mode: 'unknown' };

  const content = readFileSync(path, 'utf16le');
  const match = DISPLAY_MODE_PATTERN.exec(content);
  if (!match) return { mode: 'unknown' };
  return { mode: known.values[match[2]] ?? 'unknown' };
}

/**
 * Troca apenas o valor de `Display_Mode`, preservando o restante do XML e sua
 * codificação UTF-16LE. Guarda um `.bak` com o conteúdo original antes de alterar.
 */
export function setGameBorderless(game: OverlayGame, deps: DisplayModeDeps): GameDisplayModeInfo {
  const path = configPath(game, deps);
  const known = knownGameFor(game);
  if (!path || !known || !existsSync(path)) return { mode: 'unknown' };

  const content = readFileSync(path, 'utf16le');
  const match = DISPLAY_MODE_PATTERN.exec(content);
  if (!match) return { mode: 'unknown' };

  const current = known.values[match[2]] ?? 'unknown';
  if (current === 'borderless' || current === 'unknown') return { mode: current };

  const backup = `${path}.bak`;
  if (!existsSync(backup)) writeFileSync(backup, content, 'utf16le');

  const patched = content.replace(
    DISPLAY_MODE_PATTERN,
    (_all, prefix: string, _value: string, suffix: string) =>
      `${prefix}${known.borderlessValue}${suffix}`
  );
  writeFileSync(path, patched, 'utf16le');
  return { mode: 'borderless' };
}
