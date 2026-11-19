import {
  mkdirSync as fsMkdirSync,
  readdirSync as fsReaddirSync,
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { getDataDir } from './data-service';
import { inferGameName } from './overlay-storage';

const STORE_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/';
const COVER_BASE_URL = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps';

interface ResolveDeps {
  readdirSync?: (path: string) => string[];
  readFileSync?: (path: string) => string;
  fetchFn?: typeof fetch;
}

interface DownloadDeps {
  fetchFn?: typeof fetch;
  writeFileSync?: (path: string, data: Buffer) => void;
  mkdirSync?: (path: string, options?: { recursive?: boolean }) => void;
}

/** Normaliza para comparação: minúsculas, sem espaços nem pontuação. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Extrai de `.../steamapps/common/<installdir>/...` o caminho e o installdir. */
function steamCommon(exePath: string): { steamappsDir: string; installDir: string } | null {
  const parts = exePath.split(/[\\/]/);
  const commonIndex = parts.findIndex(
    (p, i) => p.toLowerCase() === 'steamapps' && parts[i + 1]?.toLowerCase() === 'common'
  );
  if (commonIndex < 0 || !parts[commonIndex + 2]) return null;
  return {
    steamappsDir: parts.slice(0, commonIndex + 1).join('\\') || '\\',
    installDir: parts[commonIndex + 2],
  };
}

/**
 * Descobre o appid da Steam para um executável: primeiro pelos appmanifests
 * instalados (installdir → appid), depois pela API storesearch por nome.
 */
export async function resolveSteamAppId(
  exePath: string,
  deps: ResolveDeps = {}
): Promise<number | null> {
  const readdir = deps.readdirSync ?? fsReaddirSync;
  const readFile = deps.readFileSync ?? ((path: string) => fsReadFileSync(path, 'utf-8'));
  const fetchFn = deps.fetchFn ?? fetch;
  const common = steamCommon(exePath);

  if (common) {
    try {
      const manifests = readdir(common.steamappsDir).filter((name) =>
        /^appmanifest_\d+\.acf$/i.test(name)
      );
      for (const manifest of manifests) {
        const appid = Number(manifest.match(/appmanifest_(\d+)/)?.[1]);
        if (!Number.isFinite(appid)) continue;
        const raw = readFile(resolve(common.steamappsDir, manifest));
        const installDir = raw.match(/"installdir"\s+"([^"]+)"/)?.[1];
        if (installDir && normalize(installDir) === normalize(common.installDir)) {
          return appid;
        }
      }
    } catch {
      // Sem acesso à pasta da Steam: cai para a busca online.
    }
  }

  const term = common?.installDir ?? inferGameName(exePath);
  try {
    const url = `${STORE_SEARCH_URL}?term=${encodeURIComponent(term)}&l=portuguese&cc=BR`;
    const response = await fetchFn(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      items?: Array<{ id?: number; name?: string; type?: string }>;
    };
    const apps = (payload.items ?? []).filter((item) => item.type === 'app');
    const exact = apps.find((item) => item.name && normalize(item.name) === normalize(term));
    const chosen = exact ?? apps[0];
    return typeof chosen?.id === 'number' ? chosen.id : null;
  } catch {
    return null;
  }
}

/** Baixa a capa vertical e devolve o nome do arquivo salvo em `covers/`. */
export async function downloadSteamCover(
  appId: number,
  deps: DownloadDeps = {}
): Promise<string | null> {
  const fetchFn = deps.fetchFn ?? fetch;
  const mkdir = deps.mkdirSync ?? fsMkdirSync;
  const write = deps.writeFileSync ?? fsWriteFileSync;
  const coversDir = resolve(getDataDir(), 'covers');

  try {
    const response = await fetchFn(`${COVER_BASE_URL}/${appId}/library_600x900.jpg`);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    mkdir(coversDir, { recursive: true });
    const filename = `${appId}.jpg`;
    write(resolve(coversDir, filename), buffer);
    return filename;
  } catch {
    return null;
  }
}

/** Lê a capa do disco como data URL (o renderer não pode abrir `file://`). */
export function readCoverDataUrl(fileName: string): string | null {
  if (!/^\d+\.jpg$/i.test(fileName)) return null;
  try {
    const buffer = fsReadFileSync(resolve(getDataDir(), 'covers', fileName));
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Nome do arquivo de capa esperado no disco (sem depender da rede). */
export function coverFileName(appId: number): string {
  return `${appId}.jpg`;
}

export function coverPath(appId: number): string {
  return resolve(getDataDir(), 'covers', coverFileName(appId));
}
