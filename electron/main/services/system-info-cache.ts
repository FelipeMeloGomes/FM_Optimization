import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { DashboardData } from '../../shared/ipc-types';

const CACHE_VERSION = 3;
const CACHE_FILE = 'system-cache.json';

function getCachePath(): string {
  const userData = app.getPath('userData');
  return join(userData, CACHE_FILE);
}

export interface SystemCache {
  version: number;
  timestamp: string;
  data: DashboardData;
}

export function readSystemCache(): SystemCache | null {
  const path = getCachePath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as SystemCache;
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSystemCache(data: DashboardData): void {
  const path = getCachePath();
  const tmpPath = `${path}.tmp`;

  try {
    const cache: SystemCache = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      data,
    };
    writeFileSync(tmpPath, JSON.stringify(cache), 'utf-8');
    renameSync(tmpPath, path);
  } catch {
    /* sem permissão de escrita: cache não é crítico */
  }
}
