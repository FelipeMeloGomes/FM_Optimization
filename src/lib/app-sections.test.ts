import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import {
  ALL_APP_SECTIONS,
  APPS_SECTIONS,
  DEBLOAT_SCRIPT_IDS,
  DEBLOAT_SECTIONS,
} from './app-sections';
import { getScriptRoute } from './category-routes';

/**
 * Aplicativos e Debloat dividem a mesma categoria "Apps" do catalogo, cada uma
 * mostrando um subconjunto fixo de ids. Este teste usa o scripts.json real para
 * garantir que os dois lados somados cobrem todos os scripts da categoria: um id
 * fora das secoes sumiria da interface sem ninguem notar.
 */
const scripts = JSON.parse(
  readFileSync(new URL('../../resources/scripts.json', import.meta.url), 'utf-8')
) as ScriptEntry[];

const appsScripts = scripts.filter((s) => s.category === 'Apps');
const catalogIds = new Set(scripts.map((s) => s.id));
const sectionedIds = ALL_APP_SECTIONS.flatMap((section) => section.scriptIds);

describe('secoes das paginas Aplicativos e Debloat', () => {
  it('cobre os 8 scripts de category "Apps" do catalogo', () => {
    expect(appsScripts).toHaveLength(8);
    expect([...sectionedIds].sort()).toEqual(appsScripts.map((s) => s.id).sort());
  });

  it('todo scriptId das secoes existe no catalogo', () => {
    expect(sectionedIds.filter((id) => !catalogIds.has(id))).toEqual([]);
  });

  it('nenhum script aparece em duas secoes', () => {
    expect(new Set(sectionedIds).size).toBe(sectionedIds.length);
  });

  it('toda secao tem ao menos um script', () => {
    const empty = ALL_APP_SECTIONS.filter((section) => section.scriptIds.length === 0);
    expect(empty.map((section) => section.id)).toEqual([]);
  });

  it('a busca manda script de debloat para /debloat e os demais para /apps', () => {
    for (const section of DEBLOAT_SECTIONS) {
      for (const id of section.scriptIds) {
        expect(getScriptRoute({ id, category: 'Apps' })).toBe('/debloat');
      }
    }
    for (const section of APPS_SECTIONS) {
      for (const id of section.scriptIds) {
        expect(getScriptRoute({ id, category: 'Apps' })).toBe('/apps');
      }
    }
  });

  it('DEBLOAT_SCRIPT_IDS cobre exatamente os scripts dos cards de debloat', () => {
    expect([...DEBLOAT_SCRIPT_IDS].sort()).toEqual(
      DEBLOAT_SECTIONS.flatMap((section) => section.scriptIds).sort()
    );
    expect(DEBLOAT_SCRIPT_IDS.size).toBe(6);
  });
});
