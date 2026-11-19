import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import type { GpuCatalog, GpuCatalogEntry } from '../../shared/ipc-types';

/**
 * Catálogo de placas de vídeo usado pelo comparador. O app roda com
 * `connect-src 'self'` no renderer, então o download acontece no main process.
 * A fonte é um dataset público versionado, publicado no repositório via CDN,
 * com fallback local para funcionar offline.
 */

export const GPU_CATALOG_URL =
  'https://cdn.jsdelivr.net/gh/FelipeMeloGomes/FM_Optimization@main/resources/gpu-dataset.json';

const CACHE_VERSION = 1;
const CACHE_FILE = 'gpu-catalog.json';
const DATASET_FILE = 'gpu-dataset.json';
const TIMEOUT_MS = 12_000;

const gpuEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  manufacturer: z.string().min(1),
  architecture: z.string().optional(),
  codename: z.string().optional(),
  vramGb: z.number().nonnegative().optional(),
  vramType: z.string().optional(),
  memoryBusBits: z.number().nonnegative().optional(),
  memoryBandwidthGbps: z.number().nonnegative().optional(),
  tdpWatts: z.number().nonnegative().optional(),
  boostClockMhz: z.number().nonnegative().optional(),
  shaderCount: z.number().nonnegative().optional(),
  processNm: z.number().nonnegative().optional(),
  releaseYear: z.number().int().optional(),
  performanceScore: z.number().positive(),
});

const catalogSchema = z.object({
  version: z.number(),
  source: z.string(),
  sourceUrl: z.string(),
  updatedAt: z.string(),
  gpus: z.array(gpuEntrySchema).min(1),
});

const cachedSchema = z.object({
  version: z.number(),
  timestamp: z.string(),
  data: catalogSchema,
});

export interface GpuCatalogResult extends GpuCatalog {
  /** true quando os dados vieram do cache em disco, não da rede. */
  isFromCache: boolean;
}

export interface GpuCatalogOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

class InvalidCatalogError extends Error {}

function getCachePath(): string {
  return join(app.getPath('userData'), CACHE_FILE);
}

function getBundledDatasetPath(): string {
  const appPath = app.getAppPath?.() ?? process.cwd();
  // No dev o electron-vite aponta `resourcesPath` para a pasta interna do
  // Electron (node_modules/electron/dist/resources), que não contém o dataset.
  // O arquivo fica em `<appPath>/resources`; no pacote final o electron-builder
  // copia `resources/*.json` para `<resourcesPath>`. Considerar os dois mantém
  // o fallback offline funcionando tanto no dev quanto no instalador.
  const resourcesPath = typeof process.resourcesPath === 'string' ? process.resourcesPath : appPath;
  const candidates = [
    join(resourcesPath, DATASET_FILE),
    join(resourcesPath, 'resources', DATASET_FILE),
    join(appPath, DATASET_FILE),
    join(appPath, 'resources', DATASET_FILE),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

function normalizeCatalog(raw: unknown): GpuCatalog {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidCatalogError('Catálogo de placas de vídeo inválido.');

  const gpus: GpuCatalogEntry[] = parsed.data.gpus.map((gpu) => ({
    ...gpu,
    name: gpu.name.replace(/\s+/g, ' ').trim(),
    manufacturer: gpu.manufacturer.trim().toUpperCase(),
    performanceScore: Math.round(gpu.performanceScore * 10) / 10,
  }));

  return { ...parsed.data, gpus: gpus.sort((a, b) => b.performanceScore - a.performanceScore) };
}

function readFromDisk(): GpuCatalog | null {
  const cached = cachedSchema.safeParse(readJson(getCachePath()));
  if (cached.success) return normalizeCatalog(cached.data.data);

  const bundled = catalogSchema.safeParse(readJson(getBundledDatasetPath()));
  if (bundled.success) return normalizeCatalog(bundled.data);

  return null;
}

function writeCache(data: GpuCatalog): void {
  const path = getCachePath();
  const tmpPath = `${path}.tmp`;

  try {
    const cache = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      data,
    };
    writeFileSync(tmpPath, JSON.stringify(cache), 'utf-8');
    renameSync(tmpPath, path);
  } catch {
    // Cache não é crítico: o dataset público segue disponível na próxima execução.
  }
}

export async function getGpuCatalog(options: GpuCatalogOptions = {}): Promise<GpuCatalogResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  try {
    const response = await fetchFn(GPU_CATALOG_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Falha ao carregar catálogo: HTTP ${response.status}`);

    const catalog = normalizeCatalog(await response.json());
    writeCache(catalog);
    return { ...catalog, isFromCache: false };
  } catch (error) {
    if (error instanceof InvalidCatalogError) throw error;

    const fallback = readFromDisk();
    if (fallback) return { ...fallback, isFromCache: true };

    throw new Error(
      'Não foi possível carregar o catálogo de placas de vídeo. Verifique sua conexão e tente novamente.'
    );
  }
}
