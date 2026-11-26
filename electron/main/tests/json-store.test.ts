import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonStore, writeJsonAtomic } from '../utils/json-store';

let dir: string;

beforeEach(() => {
  dir = join(tmpdir(), `fm-json-store-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createJsonStore', () => {
  it('devolve o fallback quando o arquivo não existe', () => {
    const store = createJsonStore({ path: join(dir, 'missing.json'), fallback: { n: 1 } });

    expect(store.read()).toEqual({ n: 1 });
    expect(existsSync(join(dir, 'missing.json'))).toBe(false);
  });

  it('lê JSON válido e preserva o valor após escrita', () => {
    const path = join(dir, 'state.json');
    const store = createJsonStore({ path, fallback: { n: 0 } });

    store.write({ n: 42 });

    expect(store.read()).toEqual({ n: 42 });
    expect(readFileSync(path, 'utf8')).toBe('{"n":42}');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('notifica corruption e devolve o fallback em JSON inválido', () => {
    const path = join(dir, 'broken.json');
    writeFileSync(path, '{ quebrado');
    const onCorrupt = vi.fn();

    const store = createJsonStore<string[]>({ path, fallback: [], onCorrupt });

    expect(store.read()).toEqual([]);
    expect(onCorrupt).toHaveBeenCalledTimes(1);
    expect(onCorrupt.mock.calls[0]?.[0]).toBe(path);
    expect(onCorrupt.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });

  it('trata valor que falha na validação como corrompido', () => {
    const path = join(dir, 'invalid.json');
    writeFileSync(path, '"texto"');
    const onCorrupt = vi.fn();

    const store = createJsonStore({
      path,
      fallback: { n: 0 },
      validate: (value): value is { n: number } =>
        typeof value === 'object' && value !== null && 'n' in value,
      onCorrupt,
    });

    expect(store.read()).toEqual({ n: 0 });
    expect(onCorrupt).toHaveBeenCalledTimes(1);
  });

  it('aceita JSON válido aprovado pela validação', () => {
    const path = join(dir, 'valid.json');
    writeFileSync(path, '{"n":7}');

    const store = createJsonStore({
      path,
      fallback: { n: 0 },
      validate: (value): value is { n: number } =>
        typeof value === 'object' && value !== null && 'n' in value,
    });

    expect(store.read()).toEqual({ n: 7 });
  });

  it('formata com indentação quando pretty é pedido', () => {
    const path = join(dir, 'pretty.json');
    const store = createJsonStore({ path, fallback: {}, pretty: true });

    store.write({ a: 1 });

    expect(readFileSync(path, 'utf8')).toBe('{\n  "a": 1\n}');
  });
});

describe('writeJsonAtomic', () => {
  it('cria o diretório seis falta e substitui arquivo existente sem resíduo .tmp', () => {
    const nested = join(dir, 'a', 'b');
    const path = join(nested, 'value.json');
    writeJsonAtomic(path, { old: true });
    writeJsonAtomic(path, { old: false });

    expect(existsSync(nested)).toBe(true);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ old: false });
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });
});
