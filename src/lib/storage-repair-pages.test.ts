import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { getScriptRoute } from './category-routes';
import { REPAIR_SECTIONS } from './repair-sections';
import { STORAGE_SECTIONS } from './storage-sections';
import { UTIL_SECTIONS } from './util-sections';

/**
 * Armazenamento e Reparo do Sistema saem de Utilitários e viram páginas
 * próprias. O catálogo é a fonte real usada por `useScriptPage` e pelo Ctrl+K,
 * então um script com categoria sem rota desapareceria da interface sem erro.
 */
const scripts = JSON.parse(
  readFileSync(new URL('../../resources/scripts.json', import.meta.url), 'utf-8')
) as ScriptEntry[];

function categoryOf(id: string): string {
  const script = scripts.find((entry) => entry.id === id);
  if (!script) throw new Error(`Script ${id} não encontrado no catálogo`);
  return script.category;
}

const STORAGE_IDS = ['util-2', 'util-4', 'util-5', 'builtin-88', 'util-6'];
const REPAIR_IDS = ['builtin-87', 'builtin-40', 'builtin-64'];

describe('páginas próprias de Armazenamento e Reparo do Sistema', () => {
  it.each(STORAGE_IDS)('%s passa a morar em Armazenamento', (id) => {
    expect(categoryOf(id)).toBe('Armazenamento');
  });

  it.each(REPAIR_IDS)('%s passa a morar em Reparo do Sistema', (id) => {
    expect(categoryOf(id)).toBe('Reparo do Sistema');
  });

  it('a busca encaminha cada categoria nova para a sua página', () => {
    expect(getScriptRoute({ id: 'util-2', category: 'Armazenamento' })).toBe('/armazenamento');
    expect(getScriptRoute({ id: 'builtin-87', category: 'Reparo do Sistema' })).toBe(
      '/reparo-do-sistema'
    );
  });

  it('os cards de Armazenamento cobrem exatamente os scripts da categoria', () => {
    expect(STORAGE_SECTIONS.flatMap((section) => section.scriptIds).sort()).toEqual(
      [...STORAGE_IDS].sort()
    );
  });

  it('os cards de Reparo do Sistema cobrem exatamente os scripts da categoria', () => {
    expect(REPAIR_SECTIONS.flatMap((section) => section.scriptIds).sort()).toEqual(
      [...REPAIR_IDS].sort()
    );
  });

  it('Utilitários não mostra mais os scripts que viraram página própria', () => {
    const utilIds = UTIL_SECTIONS.flatMap((section) => section.scriptIds);
    expect(utilIds.filter((id) => [...STORAGE_IDS, ...REPAIR_IDS].includes(id))).toEqual([]);
  });

  it('nenhum script aparece em duas páginas', () => {
    const allIds = [
      ...STORAGE_SECTIONS.flatMap((section) => section.scriptIds),
      ...REPAIR_SECTIONS.flatMap((section) => section.scriptIds),
      ...UTIL_SECTIONS.flatMap((section) => section.scriptIds),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('Performance e Otimização Completa saem de Utilitários e do catálogo', () => {
    const ids = scripts.map((script) => script.id);
    expect(ids).not.toContain('builtin-15');
    expect(ids).not.toContain('builtin-13');
    expect(UTIL_SECTIONS.map((section) => section.name)).not.toContain('Performance');
    expect(UTIL_SECTIONS.map((section) => section.name)).not.toContain('Otimização Completa');
  });
});
