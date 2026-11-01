import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { DEBLOAT_SECTIONS } from './app-sections';
import { CATEGORY_ROUTES, getScriptRoute } from './category-routes';
import { PRIVACY_SECTIONS } from './privacy-sections';
import { UTIL_SECTIONS } from './util-sections';

/**
 * A refatoração redistribuiu os scripts entre as páginas. O catálogo é a fonte
 * real: `useScriptPage` filtra por `category` e o Ctrl+K roteia por ela, então
 * um script com categoria sem rota (ou uma página sem card para o id) some da
 * interface sem erro nenhum. Este teste fixa o destino de cada script movido e
 * exige que cada categoria do catálogo tenha exatamente uma rota.
 */
const scripts = JSON.parse(
  readFileSync(new URL('../../resources/scripts.json', import.meta.url), 'utf-8')
) as ScriptEntry[];

function find(id: string): ScriptEntry {
  const script = scripts.find((s) => s.id === id);
  if (!script) throw new Error(`Script ${id} not found`);
  return script;
}

function idsOf(sections: readonly { scriptIds: string[] }[]): string[] {
  return sections.flatMap((section) => section.scriptIds).sort();
}

function idsInCategory(category: string): string[] {
  return scripts
    .filter((script) => script.category === category)
    .map((script) => script.id)
    .sort();
}

const categoriesInCatalog = [...new Set(scripts.map((script) => script.category))].sort();

describe('cada script mora em uma unica pagina', () => {
  it('toda categoria do catalogo tem rota e toda rota de categoria tem script', () => {
    expect(categoriesInCatalog).toEqual(Object.keys(CATEGORY_ROUTES).sort());
  });

  it('as paginas Ajustes e Aplicativos nao existem mais', () => {
    expect(categoriesInCatalog).not.toContain('Tweaks');
    expect(categoriesInCatalog).not.toContain('Apps');
    expect(Object.values(CATEGORY_ROUTES)).not.toContain('/tweaks');
    expect(Object.values(CATEGORY_ROUTES)).not.toContain('/apps');
  });

  it('nenhum script aparece em duas paginas', () => {
    const sectioned = [
      ...idsOf(DEBLOAT_SECTIONS),
      ...idsOf(PRIVACY_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ];
    expect(new Set(sectioned).size).toBe(sectioned.length);
  });

  it('todo id de card existe no catalogo', () => {
    const known = new Set(scripts.map((script) => script.id));
    const missing = [
      ...idsOf(DEBLOAT_SECTIONS),
      ...idsOf(PRIVACY_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ].filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });

  it('os cards da pagina Debloat cobrem exatamente a categoria Debloat', () => {
    expect(idsOf(DEBLOAT_SECTIONS)).toEqual(idsInCategory('Debloat'));
  });

  it('os cards da pagina Privacidade cobrem exatamente a categoria Seguranca', () => {
    expect(idsOf(PRIVACY_SECTIONS)).toEqual(idsInCategory('Segurança'));
  });

  it('os cards da pagina Utilitarios cobrem exatamente a categoria Utilities', () => {
    expect(idsOf(UTIL_SECTIONS)).toEqual(idsInCategory('Utilities'));
  });

  it('a pagina Processador e a categoria CPU: 42 scripts, incluindo os movidos', () => {
    expect(idsInCategory('CPU')).toHaveLength(42);
  });

  it('a busca manda cada script para a pagina onde ele aparece', () => {
    expect(getScriptRoute({ id: 'apps-1', category: 'Segurança' })).toBe('/privacidade-seguranca');
    expect(getScriptRoute({ id: 'apps-3', category: 'Debloat' })).toBe('/debloat');
    expect(getScriptRoute({ id: 'builtin-18', category: 'Internet' })).toBe('/rede');
    expect(getScriptRoute({ id: 'builtin-13', category: 'Utilities' })).toBe('/utilities');
    expect(getScriptRoute({ id: 'tweaks-4', category: 'CPU' })).toBe('/cpu');
  });
});

describe('destino dos scripts movidos pela refatoracao', () => {
  const DESTINATIONS: Array<[string, string]> = [
    // Rede
    ['builtin-18', 'Internet'],
    // Processador: AMD/GPU + card Desempenho da antiga pagina Ajustes
    ['builtin-4', 'CPU'],
    ['builtin-5', 'CPU'],
    ['builtin-6', 'CPU'],
    ['builtin-7', 'CPU'],
    ['tweaks-3', 'CPU'],
    ['tweaks-4', 'CPU'],
    ['tweaks-5', 'CPU'],
    ['tweaks-6', 'CPU'],
    // Debloat: card Otimizacao Visual inteiro
    ['tweaks-1', 'Debloat'],
    ['tweaks-2', 'Debloat'],
    ['builtin-32', 'Debloat'],
    ['builtin-86', 'Debloat'],
    // Utilitarios
    ['builtin-13', 'Utilities'],
    // Pagina nova de Privacidade
    ['apps-1', 'Segurança'],
    ['apps-2', 'Segurança'],
  ];

  it.each(DESTINATIONS)('%s mora na categoria %s', (id, category) => {
    expect(find(id).category).toBe(category);
  });

  it('mantem todos os 100 scripts no catalogo', () => {
    expect(scripts).toHaveLength(100);
  });
});
