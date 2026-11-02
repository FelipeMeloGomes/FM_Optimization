import { describe, expect, it } from 'vitest';
import { DEBLOAT_SECTIONS } from './app-sections';
import { PERSONALIZATION_SECTIONS } from './personalization-sections';

/**
 * A cobertura das categorias pelos cards é verificada em
 * script-pages.test.ts, contra o catalogo real. Aqui ficam só as invariantes
 * internas dos cards: nenhum card vazio, nenhum script em dois cards.
 */
describe('cards da pagina Debloat', () => {
  it('todo card tem ao menos um script', () => {
    const empty = DEBLOAT_SECTIONS.filter((section) => section.scriptIds.length === 0);
    expect(empty.map((section) => section.id)).toEqual([]);
  });

  it('nenhum script aparece em dois cards', () => {
    const ids = DEBLOAT_SECTIONS.flatMap((section) => section.scriptIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mantem apenas os cards de remocao de software', () => {
    expect(DEBLOAT_SECTIONS.map((section) => section.id)).toEqual([
      'debloat',
      'discord',
      'spotify',
    ]);
  });

  it('nao lista mais o card de aparencia', () => {
    const ids = DEBLOAT_SECTIONS.flatMap((section) => section.scriptIds);
    expect(ids).not.toContain('tweaks-1');
    expect(ids).not.toContain('tweaks-2');
    expect(ids).not.toContain('builtin-32');
    expect(ids).not.toContain('builtin-86');
  });
});

describe('cards da pagina Personalizacao', () => {
  it('todo card tem ao menos um script', () => {
    const empty = PERSONALIZATION_SECTIONS.filter((section) => section.scriptIds.length === 0);
    expect(empty.map((section) => section.id)).toEqual([]);
  });

  it('nenhum script aparece em dois cards', () => {
    const ids = PERSONALIZATION_SECTIONS.flatMap((section) => section.scriptIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('separa barra de tarefas/menus de efeitos visuais', () => {
    expect(PERSONALIZATION_SECTIONS.map((section) => section.id)).toEqual(['shell', 'effects']);
    expect(PERSONALIZATION_SECTIONS[0].scriptIds).toEqual(['tweaks-1', 'builtin-86']);
    expect(PERSONALIZATION_SECTIONS[1].scriptIds).toEqual(['tweaks-2', 'builtin-32']);
  });
});
