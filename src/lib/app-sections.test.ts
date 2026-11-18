import { describe, expect, it } from 'vitest';
import { PERSONALIZATION_SECTIONS } from './personalization-sections';

/**
 * A cobertura das categorias pelos cards é verificada em
 * script-pages.test.ts, contra o catalogo real. Aqui ficam só as invariantes
 * internas dos cards: nenhum card vazio, nenhum script em dois cards.
 */
describe('cards da pagina Personalizacao', () => {
  it('todo card tem ao menos um script', () => {
    const empty = PERSONALIZATION_SECTIONS.filter((section) => section.scriptIds.length === 0);
    expect(empty.map((section) => section.id)).toEqual([]);
  });

  it('nenhum script aparece em dois cards', () => {
    const ids = PERSONALIZATION_SECTIONS.flatMap((section) => section.scriptIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('separa barra de tarefas/menus, efeitos visuais e mods de apps', () => {
    expect(PERSONALIZATION_SECTIONS.map((section) => section.id)).toEqual([
      'shell',
      'effects',
      'discord',
      'spotify',
    ]);
    expect(PERSONALIZATION_SECTIONS[0].scriptIds).toEqual(['tweaks-1', 'builtin-86']);
    expect(PERSONALIZATION_SECTIONS[1].scriptIds).toEqual(['tweaks-2', 'builtin-32']);
    expect(PERSONALIZATION_SECTIONS[2].scriptIds).toEqual(['apps-4', 'apps-5']);
    expect(PERSONALIZATION_SECTIONS[3].scriptIds).toEqual(['apps-6', 'apps-7']);
  });

  it('mantem os reverters de Discord e Spotify ao lado dos mods', () => {
    const ids = PERSONALIZATION_SECTIONS.flatMap((section) => section.scriptIds);
    expect(ids).toContain('apps-5');
    expect(ids).toContain('apps-7');
  });
});
