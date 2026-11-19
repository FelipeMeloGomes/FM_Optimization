import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => 'C:\\UserData' },
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn((path: string) => {
    if (path.endsWith('730.jpg')) return Buffer.from('capa');
    throw new Error('ENOENT');
  }),
  writeFileSync: vi.fn(),
}));

import { downloadSteamCover, readCoverDataUrl, resolveSteamAppId } from '../services/steam-cover';

function fakeFetch(response: unknown): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe('steam-cover', () => {
  it('resolve o appid pelo installdir do appmanifest', async () => {
    const acf =
      '"AppState"\n{\n "appid"\t\t"730"\n "installdir"\t\t"Counter-Strike Global Offensive"\n}';
    await expect(
      resolveSteamAppId('C:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\cs2.exe', {
        readdirSync: () => ['appmanifest_730.acf'],
        readFileSync: () => acf,
      })
    ).resolves.toBe(730);
  });

  it('usa storesearch como fallback e aceita o primeiro app', async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({ items: [{ id: 1091500, name: 'Cyberpunk 2077', type: 'app' }] }),
    });
    await expect(
      resolveSteamAppId('C:\\Jogos\\Cyberpunk 2077\\bin\\Cyberpunk2077.exe', {
        readdirSync: () => [],
        fetchFn,
      })
    ).resolves.toBe(1091500);
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/api/storesearch/'));
  });

  it('devolve null quando não há match', async () => {
    await expect(
      resolveSteamAppId('C:\\Jogos\\Meu Jogo\\jogo.exe', {
        readdirSync: () => [],
        fetchFn: fakeFetch({ ok: true, json: async () => ({ items: [] }) }),
      })
    ).resolves.toBeNull();
  });

  it('devolve null quando a rede falha no fallback', async () => {
    await expect(
      resolveSteamAppId('C:\\Jogos\\Meu Jogo\\jogo.exe', {
        readdirSync: () => [],
        fetchFn: fakeFetch({ ok: false, status: 503 }),
      })
    ).resolves.toBeNull();
  });

  it('salva a capa vertical em covers/ e devolve o nome do arquivo', async () => {
    const writeFileSync = vi.fn();
    await expect(
      downloadSteamCover(730, {
        fetchFn: fakeFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
        writeFileSync,
        mkdirSync: vi.fn(),
      })
    ).resolves.toBe('730.jpg');
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('730.jpg'),
      expect.any(Buffer)
    );
  });

  it('devolve null quando a CDN não tem a capa', async () => {
    await expect(
      downloadSteamCover(999999, {
        fetchFn: fakeFetch({ ok: false, status: 404 }),
        mkdirSync: vi.fn(),
      })
    ).resolves.toBeNull();
  });

  it('lê a capa como data URL para o renderer', () => {
    expect(readCoverDataUrl('730.jpg')).toBe(
      `data:image/jpeg;base64,${Buffer.from('capa').toString('base64')}`
    );
  });

  it('rejeita nomes que não são capas e arquivos ausentes', () => {
    expect(readCoverDataUrl('../../../windows/system.ini')).toBeNull();
    expect(readCoverDataUrl('999999.jpg')).toBeNull();
  });
});
