import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_ROUTE_KEY, normalizeRoute, readLastRoute, writeLastRoute } from './last-route';

const KNOWN = ['/', '/cpu', '/rede', '/settings'];

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(LAST_ROUTE_KEY, initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    raw: data,
  };
}

describe('normalizeRoute', () => {
  it('aceita uma rota existente', () => {
    expect(normalizeRoute('/rede', KNOWN)).toBe('/rede');
  });

  it('rejeita rota que nao existe mais (pagina removida em atualizacao)', () => {
    expect(normalizeRoute('/tweaks', KNOWN)).toBeNull();
  });

  it('rejeita valor vazio ou nulo', () => {
    expect(normalizeRoute(null, KNOWN)).toBeNull();
    expect(normalizeRoute('', KNOWN)).toBeNull();
    expect(normalizeRoute('   ', KNOWN)).toBeNull();
  });

  it('rejeita caminho relativo, hash e URL externa', () => {
    expect(normalizeRoute('cpu', KNOWN)).toBeNull();
    expect(normalizeRoute('#/cpu', KNOWN)).toBeNull();
    expect(normalizeRoute('https://exemplo.com/cpu', KNOWN)).toBeNull();
  });

  it('tolera espacos em volta do valor gravado', () => {
    expect(normalizeRoute('  /cpu  ', KNOWN)).toBe('/cpu');
  });
});

describe('readLastRoute', () => {
  it('devolve a rota gravada', () => {
    expect(readLastRoute(memoryStorage('/settings'), KNOWN)).toBe('/settings');
  });

  it('devolve null quando nada foi gravado', () => {
    expect(readLastRoute(memoryStorage(), KNOWN)).toBeNull();
  });

  it('nao estoura quando o localStorage nega acesso', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(readLastRoute(storage, KNOWN)).toBeNull();
  });
});

describe('writeLastRoute', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('grava a rota atual na chave esperada', () => {
    writeLastRoute(storage, '/cpu');
    expect(storage.raw.get(LAST_ROUTE_KEY)).toBe('/cpu');
  });

  it('nao estoura quando a cota do localStorage acabou', () => {
    const onSet = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeLastRoute({ getItem: () => null, setItem: onSet }, '/cpu')).not.toThrow();
    expect(onSet).toHaveBeenCalledWith(LAST_ROUTE_KEY, '/cpu');
  });
});
