import { join } from 'node:path';
import { app } from 'electron';
import type { DashboardData } from '../../shared/ipc-types';
import { createJsonStore } from '../utils/json-store';

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

function createStore(): ReturnType<typeof createJsonStore<SystemCache | null>> {
  return createJsonStore<SystemCache | null>({
    path: getCachePath(),
    fallback: null,
    validate: (value): value is SystemCache =>
      typeof value === 'object' &&
      value !== null &&
      (value as SystemCache).version === CACHE_VERSION,
  });
}

export function readSystemCache(): SystemCache | null {
  return createStore().read();
}

export function writeSystemCache(data: DashboardData): void {
  try {
    const cache: SystemCache = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      data,
    };
    createStore().write(cache);
  } catch {
    /* sem permissão de escrita: cache não é crítico */
  }
}
