import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OverlayGame } from '../../shared/overlay-types';
import { getGameDisplayMode, setGameBorderless } from '../services/game-display-mode';

const batman: OverlayGame = {
  id: 'batman',
  name: 'Batman Arkham Knight',
  exePath: 'C:\\Jogos\\Batman Arkham Knight\\Binaries\\Win64\\BatmanAK.exe',
  processName: 'BatmanAK.exe',
  coverFile: null,
  enabled: true,
};

const cs2: OverlayGame = {
  id: 'cs2',
  name: 'Counter-Strike 2',
  exePath: 'C:\\Jogos\\CS2\\cs2.exe',
  processName: 'cs2.exe',
  coverFile: null,
  enabled: true,
};

let documents: string;
let configPath: string;

beforeEach(() => {
  documents = mkdtempSync(join(tmpdir(), 'fm-overlay-mode-'));
  configPath = join(
    documents,
    'WB Games',
    'Batman Arkham Knight',
    'GFXSettings.BatmanArkhamKnight.xml'
  );
  mkdirSync(join(documents, 'WB Games', 'Batman Arkham Knight'), { recursive: true });
});

afterEach(() => {
  rmSync(documents, { recursive: true, force: true });
});

function writeConfig(value: number): void {
  const xml =
    '<?xml version="1.0" encoding="UTF-16" standalone="no"?>\n' +
    '<GSA_SDK Version="2.3.17835760.0">\n' +
    '\t<GAMESETTINGS>\n' +
    `\t\t<OPTION Name="Display_Mode" Registered="True" Type="Integer" Value="${value}">\n` +
    '\t\t\t<RANGE MinValue="0" MaxValue="0" NumSteps="-1" />\n' +
    '\t\t</OPTION>\n' +
    '\t</GAMESETTINGS>\n' +
    '</GSA_SDK>\n';
  writeFileSync(configPath, xml, 'utf16le');
}

describe('modo de tela do jogo', () => {
  it('identifica tela cheia exclusiva no XML do Batman', () => {
    writeConfig(2);
    expect(getGameDisplayMode(batman, { documentsPath: documents })).toEqual({
      mode: 'exclusive',
    });
  });

  it.each([
    [0, 'windowed'],
    [1, 'borderless'],
  ])('identifica o valor %i como %s', (value, mode) => {
    writeConfig(value);
    expect(getGameDisplayMode(batman, { documentsPath: documents })).toEqual({ mode });
  });

  it('devolve unknown para jogos sem configuração conhecida', () => {
    writeConfig(2);
    expect(getGameDisplayMode(cs2, { documentsPath: documents })).toEqual({ mode: 'unknown' });
  });

  it('devolve unknown quando o arquivo de configuração não existe', () => {
    expect(getGameDisplayMode(batman, { documentsPath: documents })).toEqual({ mode: 'unknown' });
  });

  it('troca exclusiva por borderless e guarda backup do original', () => {
    writeConfig(2);

    const result = setGameBorderless(batman, { documentsPath: documents });

    expect(result).toEqual({ mode: 'borderless' });
    const patched = readFileSync(configPath, 'utf16le');
    expect(patched).toContain('Value="1"');
    expect(patched).not.toContain('Value="2"');
    expect(patched).toContain('Registered="True"');
    expect(readFileSync(`${configPath}.bak`, 'utf16le')).toContain('Value="2"');
  });

  it('não cria backup quando o jogo já está em borderless', () => {
    writeConfig(1);

    expect(setGameBorderless(batman, { documentsPath: documents })).toEqual({
      mode: 'borderless',
    });
    expect(() => readFileSync(`${configPath}.bak`)).toThrow();
  });

  it('não altera nada para jogos sem configuração conhecida', () => {
    expect(setGameBorderless(cs2, { documentsPath: documents })).toEqual({ mode: 'unknown' });
  });
});
