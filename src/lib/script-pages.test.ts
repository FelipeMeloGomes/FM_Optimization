import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { CATEGORY_ROUTES, getScriptRoute } from './category-routes';
import { NETWORK_SECTIONS } from './network-sections';
import { PERFORMANCE_SECTIONS } from './performance-sections';
import { PERSONALIZATION_SECTIONS } from './personalization-sections';
import { PRIVACY_SECTIONS } from './privacy-sections';
import { REPAIR_SECTIONS } from './repair-sections';
import { STORAGE_SECTIONS } from './storage-sections';
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
      ...idsOf(PRIVACY_SECTIONS),
      ...idsOf(PERSONALIZATION_SECTIONS),
      ...idsOf(STORAGE_SECTIONS),
      ...idsOf(REPAIR_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ];
    expect(new Set(sectioned).size).toBe(sectioned.length);
  });

  it('todo id de card existe no catalogo', () => {
    const known = new Set(scripts.map((script) => script.id));
    const missing = [
      ...idsOf(PRIVACY_SECTIONS),
      ...idsOf(PERSONALIZATION_SECTIONS),
      ...idsOf(STORAGE_SECTIONS),
      ...idsOf(REPAIR_SECTIONS),
      ...idsOf(UTIL_SECTIONS),
    ].filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });

  it('o catalogo nao tem mais a categoria Debloat', () => {
    // A pagina /debloat agora e um inventario de apps Appx, nao uma lista de
    // scripts: `useScriptPage` nao filtra mais nada por essa categoria.
    expect(idsInCategory('Debloat')).toEqual([]);
    expect(Object.keys(CATEGORY_ROUTES)).not.toContain('Debloat');
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

  it('o relatorio de sistema so aparece na pagina Meu PC', () => {
    expect(find('util-3').category).toBe('Meu PC');
    expect(CATEGORY_ROUTES['Meu PC']).toBe('/meu-pc');
    expect(idsOf(UTIL_SECTIONS)).not.toContain('util-3');
    expect(idsInCategory('Utilities')).not.toContain('util-3');
  });

  it('os cards de Armazenamento e Reparo cobrem suas categorias sem sobra', () => {
    expect(idsOf(STORAGE_SECTIONS)).toEqual(idsInCategory('Armazenamento'));
    expect(idsOf(REPAIR_SECTIONS)).toEqual(idsInCategory('Reparo do Sistema'));
  });

  it('os cards da pagina Rede cobrem Internet e DNS Manager sem sobra', () => {
    expect(idsOf(NETWORK_SECTIONS)).toEqual(
      [...idsInCategory('Internet'), ...idsInCategory('DNS Manager')].sort()
    );
  });

  it('as secoes da pagina Otimização do Sistema cobrem CPU, GPU e Windows, sem sobra', () => {
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

    expect(idsInCategory('CPU')).toHaveLength(12);
    expect(idsInCategory('GPU')).toHaveLength(4);
    expect(idsInCategory('Windows')).toHaveLength(3);
  });

  it('a busca manda cada script para a pagina onde ele aparece', () => {
    expect(getScriptRoute({ id: 'apps-1', category: 'Segurança' })).toBe('/privacidade-seguranca');
    expect(getScriptRoute({ id: 'apps-4', category: 'Personalização' })).toBe('/personalizacao');
    expect(getScriptRoute({ id: 'builtin-18', category: 'Internet' })).toBe('/rede');
    expect(getScriptRoute({ id: 'util-1', category: 'Utilities' })).toBe('/utilities');
    expect(getScriptRoute({ id: 'tweaks-4', category: 'Windows' })).toBe('/cpu');
    expect(getScriptRoute({ id: 'builtin-4', category: 'GPU' })).toBe('/cpu');
    expect(getScriptRoute({ id: 'tweaks-1', category: 'Personalização' })).toBe('/personalizacao');
  });
});

describe('destino dos scripts movidos pela refatoracao', () => {
  const DESTINATIONS: Array<[string, string]> = [
    // Rede
    ['builtin-18', 'Internet'],
    // Otimização do Sistema: GPU AMD em categoria propria
    ['builtin-4', 'GPU'],
    ['builtin-5', 'GPU'],
    ['builtin-6', 'GPU'],
    ['builtin-7', 'GPU'],
    // Otimização do Sistema: ajustes do Windows, nao do processador
    ['tweaks-3', 'Windows'],
    ['tweaks-4', 'Windows'],
    ['tweaks-5', 'Windows'],
    // Personalizacao: aparencia e mods de apps
    ['tweaks-1', 'Personalização'],
    ['tweaks-2', 'Personalização'],
    ['builtin-32', 'Personalização'],
    ['builtin-86', 'Personalização'],
    // Discord/Spotify sairam do Debloat e mantem o reverter ao lado
    ['apps-4', 'Personalização'],
    ['apps-5', 'Personalização'],
    ['apps-6', 'Personalização'],
    ['apps-7', 'Personalização'],
    // Utilitarios
    ['util-1', 'Utilities'],
    // Relatorios do Sistema saiu de Utilitarios e agora so mora em Meu PC
    ['util-3', 'Meu PC'],
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

  it('mantem os scripts restantes no catalogo', () => {
    expect(scripts).toHaveLength(68);
  });

  it('nao mostra na pagina Otimização do Sistema os scripts aposentados', () => {
    const retired = [
      'cpu-1',
      'cpu-2',
      'cpu-3',
      'cpu-4',
      'cpu-5',
      'cpu-6',
      'cpu-7',
      'cpu-8',
      'cpu-9',
      'cpu-10',
      'cpu-11',
      'cpu-13',
      'cpu-14',
      'cpu-15',
      'cpu-17',
      'cpu-19',
      'cpu-22',
      'cpu-23',
      'cpu-25',
      'cpu-26',
      'cpu-27',
      'cpu-28',
      'tweaks-6',
    ];
    const known = new Set(scripts.map((script) => script.id));
    const onPage = ['CPU', 'GPU', 'Windows'].flatMap((category) => idsInCategory(category));

    for (const id of retired) {
      expect(known.has(id), `catalogo: ${id}`).toBe(false);
      expect(onPage.includes(id), `secoes de Otimização do Sistema: ${id}`).toBe(false);
    }
  });

  it('aposenta o debloat por script e o Chris Titus', () => {
    const ids = scripts.map((script) => script.id);
    expect(ids).not.toContain('apps-3');
    expect(ids).not.toContain('builtin-14');
  });
});

describe('relatorio de sistema', () => {
  const report = () => find('util-3');

  it('gera os dois relatorios direto, sem menu nem pausa', () => {
    const script = report();
    expect(script.interactive).toBe(false);

    const content = Buffer.from(script.content, 'base64').toString('utf8');
    expect(content).toContain('msinfo32 /report');
    expect(content).toContain('powercfg /batteryreport');
    expect(content).not.toMatch(/choice|pause|goto|:ambos/i);
  });

  it('descreve a geracao simultanea, sem escolha de opcao', () => {
    expect(report().description).toMatch(/sem menu|ambos/i);
    expect(report().guide).not.toMatch(/escolha|opcao/i);
  });
});
