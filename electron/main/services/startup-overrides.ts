import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServiceStartMode } from '../../shared/ipc-types';

const VALID_MODES: ReadonlySet<string> = new Set([
  'Automatic',
  'AutomaticDelayed',
  'Manual',
  'Disabled',
  'Unknown',
]);

export interface StartupOverridesStore {
  getFilePath(): string;
  getServiceStartMode(name: string): ServiceStartMode | null;
  recordServiceStartMode(name: string, mode: ServiceStartMode): void;
  clearServiceStartMode(name: string): void;
  listServiceOverrides(): Record<string, ServiceStartMode>;
}

/**
 * Guarda o tipo de início original de cada serviço que a página desativou.
 * Sem isso, reativar um "Automático (Atrasado)" o transformaria em
 * "Automático" comum e a reversão não seria fiel.
 */
export function createStartupOverridesStore(dataDir: string): StartupOverridesStore {
  const filePath = resolve(dataDir, 'startup-overrides.json');

  function load(): Record<string, ServiceStartMode> {
    if (!existsSync(filePath)) return {};
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (typeof parsed !== 'object' || parsed === null) return {};

      const result: Record<string, ServiceStartMode> = {};
      for (const [name, mode] of Object.entries(parsed)) {
        if (typeof mode === 'string' && VALID_MODES.has(mode)) {
          result[name] = mode as ServiceStartMode;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  function save(data: Record<string, ServiceStartMode>): void {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    renameSync(tmpPath, filePath);
  }

  return {
    getFilePath: () => filePath,
    getServiceStartMode(name) {
      return load()[name] ?? null;
    },
    recordServiceStartMode(name, mode) {
      const data = load();
      // O primeiro valor é o original de verdade; chamadas seguintes não podem
      // sobrescrevê-lo com o estado já alterado.
      if (data[name]) return;
      data[name] = mode;
      save(data);
    },
    clearServiceStartMode(name) {
      const data = load();
      if (!data[name]) return;
      delete data[name];
      save(data);
    },
    listServiceOverrides() {
      return load();
    },
  };
}
