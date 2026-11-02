import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { DEBLOAT_SECTIONS } from './app-sections';
import { CATEGORY_ROUTES, getScriptRoute } from './category-routes';
import { PERFORMANCE_SECTIONS } from './performance-sections';
import { PERSONALIZATION_SECTIONS } from './personalization-sections';
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
      ...idsOf(PERSONALIZATION_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ];
    expect(new Set(sectioned).size).toBe(sectioned.length);
  });

  it('todo id de card existe no catalogo', () => {
    const known = new Set(scripts.map((script) => script.id));
    const missing = [
      ...idsOf(DEBLOAT_SECTIONS),
      ...idsOf(PRIVACY_SECTIONS),
      ...idsOf(PERSONALIZATION_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ].filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });

  it('os cards da pagina Debloat cobrem exatamente a categoria Debloat', () => {
    expect(idsOf(DEBLOAT_SECTIONS)).toEqual(idsInCategory('Debloat'));
  });

  it('os cards da pagina Personalizacao cobrem exatamente a categoria Personalizacao', () => {
    expect(idsOf(PERSONALIZATION_SECTIONS)).toEqual(idsInCategory('Personalização'));
  });

  it('os cards da pagina Privacidade cobrem exatamente a categoria Seguranca', () => {
    expect(idsOf(PRIVACY_SECTIONS)).toEqual(idsInCategory('Segurança'));
  });

  it('os cards da pagina Utilitarios cobrem exatamente a categoria Utilities', () => {
    expect(idsOf(UTIL_SECTIONS)).toEqual(idsInCategory('Utilities'));
  });

  it('as secoes da pagina Desempenho cobrem CPU, GPU e Windows, sem sobra', () => {
    const sections = PERFORMANCE_SECTIONS.map((section) => section.category).sort();
    expect(sections).toEqual(['CPU', 'GPU', 'Windows']);

    // Tudo que a busca manda para /cpu precisa cair em uma secao. Se uma
    // categoria nova for roteada para a pagina sem secao, o script ficaria
    // invisivel mesmo com rota valida.
    const onPage = ['CPU', 'GPU', 'Windows'].flatMap((category) => idsInCategory(category)).sort();
    const routedToCpu = scripts
      .filter((script) => getScriptRoute(script) === '/cpu')
      .map((script) => script.id)
      .sort();
    expect(onPage).toEqual(routedToCpu);

    expect(idsInCategory('CPU')).toHaveLength(34);
    expect(idsInCategory('GPU')).toHaveLength(4);
    expect(idsInCategory('Windows')).toHaveLength(4);
  });

  it('a busca manda cada script para a pagina onde ele aparece', () => {
    expect(getScriptRoute({ id: 'apps-1', category: 'Segurança' })).toBe('/privacidade-seguranca');
    expect(getScriptRoute({ id: 'apps-3', category: 'Debloat' })).toBe('/debloat');
    expect(getScriptRoute({ id: 'builtin-18', category: 'Internet' })).toBe('/rede');
    expect(getScriptRoute({ id: 'builtin-13', category: 'Utilities' })).toBe('/utilities');
    expect(getScriptRoute({ id: 'tweaks-4', category: 'Windows' })).toBe('/cpu');
    expect(getScriptRoute({ id: 'builtin-4', category: 'GPU' })).toBe('/cpu');
    expect(getScriptRoute({ id: 'tweaks-1', category: 'Personalização' })).toBe('/personalizacao');
  });
});

describe('destino dos scripts movidos pela refatoracao', () => {
  const DESTINATIONS: Array<[string, string]> = [
    // Rede
    ['builtin-18', 'Internet'],
    // Desempenho: GPU AMD em categoria propria
    ['builtin-4', 'GPU'],
    ['builtin-5', 'GPU'],
    ['builtin-6', 'GPU'],
    ['builtin-7', 'GPU'],
    // Desempenho: ajustes do Windows, nao do processador
    ['tweaks-3', 'Windows'],
    ['tweaks-4', 'Windows'],
    ['tweaks-5', 'Windows'],
    ['tweaks-6', 'Windows'],
    // Personalizacao: aparencia, nao remocao de software
    ['tweaks-1', 'Personalização'],
    ['tweaks-2', 'Personalização'],
    ['builtin-32', 'Personalização'],
    ['builtin-86', 'Personalização'],
    // Utilitarios
    ['builtin-13', 'Utilities'],
    // Pagina nova de Privacidade
    ['apps-1', 'Segurança'],
    ['apps-2', 'Segurança'],
  ];

  it.each(DESTINATIONS)('%s mora na categoria %s', (id, category) => {
    expect(find(id).category).toBe(category);
  });

  it('nao ha ajuste de GPU AMD apresentado como ajuste universal de CPU', () => {
    const gpuInCpu = scripts
      .filter((script) => script.tags.includes('gpu-amd') && script.category === 'CPU')
      .map((script) => script.id);
    expect(gpuInCpu).toEqual([]);
  });

  it('mantem todos os 100 scripts no catalogo', () => {
    expect(scripts).toHaveLength(100);
  });
});
