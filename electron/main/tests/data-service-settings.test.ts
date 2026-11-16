import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressao do `powerSaveMode`.
 *
 * O campo existia em `AppSettings` e era lido no boot, mas faltava no
 * `SettingsSchema`: o zod fazia strip no `save-settings` e o toggle nunca
 * chegava ao disco. Como o default tambem era `false`, os switches de economia
 * (`--disable-gpu`, `renderer-process-limit=1`) nunca eram aplicados em
 * producao — medido em ~31% da RAM privada em repouso.
 *
 * Os testes leem um `settings.json` real em diretorio temporario, entao
 * exercitam o caminho de leitura/escrita de verdade, nao um mock do parser.
 */

const sandbox = vi.hoisted(() => ({ appData: '' }));

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: (name: string) => {
      if (name !== 'appData') throw new Error(`caminho inesperado no teste: ${name}`);
      return sandbox.appData;
    },
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value, 'utf-8'),
    decryptString: (value: Buffer) => value.toString('utf-8'),
  },
}));

import { loadSettings, saveSettings } from '../services/data-service';

function dataDir(): string {
  return join(sandbox.appData, 'fm-optimize');
}

function settingsFile(): string {
  return join(dataDir(), 'settings.json');
}

function writeSettings(value: unknown): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(value), 'utf-8');
}

beforeEach(() => {
  sandbox.appData = mkdtempSync(join(tmpdir(), 'fm-optimize-settings-'));
});

afterEach(() => {
  rmSync(sandbox.appData, { recursive: true, force: true });
});

describe('powerSaveMode no settings.json', () => {
  it('vem habilitado quando o arquivo ainda nao existe', () => {
    expect(loadSettings().powerSaveMode).toBe(true);
  });

  it('vem habilitado para instalacoes antigas que nunca gravaram a chave', () => {
    writeSettings({ theme: 'dark', soundEnabled: true });
    expect(loadSettings().powerSaveMode).toBe(true);
  });

  it('respeita o usuario que desligou o modo economia', () => {
    writeSettings({ powerSaveMode: false });
    expect(loadSettings().powerSaveMode).toBe(false);
  });

  it('persiste a escolha do usuario no arquivo', () => {
    const settings = loadSettings();
    settings.powerSaveMode = false;
    saveSettings(settings);

    const written = JSON.parse(readFileSync(settingsFile(), 'utf-8')) as {
      powerSaveMode?: boolean;
    };
    expect(written.powerSaveMode).toBe(false);
    expect(loadSettings().powerSaveMode).toBe(false);
  });
});
