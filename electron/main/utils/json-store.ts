import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface JsonStoreOptions<T> {
  path: string;
  fallback: T;
  validate?: (value: unknown) => value is T;
  ensureDir?: boolean;
  pretty?: boolean;
  onCorrupt?: (path: string, error: unknown) => void;
}

export interface WriteJsonAtomicOptions {
  pretty?: boolean;
  ensureDir?: boolean;
}

/** Escreve em `.tmp` e renomeia, para nunca deixar JSON pela metade no disco. */
export function writeJsonAtomic(
  path: string,
  value: unknown,
  options: WriteJsonAtomicOptions = {}
): void {
  if (options.ensureDir !== false) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const tempPath = `${path}.tmp`;
  const serialized = options.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  writeFileSync(tempPath, serialized, 'utf8');
  renameSync(tempPath, path);
}

/** Leitura com fallback, opcionalmente validada, sobre um arquivo JSON no userData. */
export function createJsonStore<T>(options: JsonStoreOptions<T>): {
  read(): T;
  write(value: T): void;
} {
  const { path, fallback, validate, onCorrupt } = options;

  return {
    read(): T {
      if (!existsSync(path)) return fallback;

      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
      } catch (error) {
        onCorrupt?.(path, error);
        return fallback;
      }

      if (validate && !validate(parsed)) {
        onCorrupt?.(path, new Error(`Valor inválido em ${path}`));
        return fallback;
      }

      return parsed as T;
    },

    write(value: T): void {
      writeJsonAtomic(path, value, { pretty: options.pretty, ensureDir: options.ensureDir });
    },
  };
}
