import { describe, expect, it } from 'vitest';
import { DEBLOAT_SECTIONS } from './app-sections';

/**
 * A cobertura da categoria "Debloat" pelos cards é verificada em
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

  it('mantem os cards de debloat que ja existiam', () => {
    expect(DEBLOAT_SECTIONS.map((section) => section.id)).toEqual([
      'debloat',
      'discord',
      'spotify',
      'visual',
    ]);
  });

  it('o card Otimização Visual traz os quatro scripts que sairam da pagina Ajustes', () => {
    const visual = DEBLOAT_SECTIONS.find((section) => section.id === 'visual');
    expect(visual?.name).toBe('Otimização Visual');
    expect(visual?.scriptIds).toEqual(['tweaks-1', 'tweaks-2', 'builtin-32', 'builtin-86']);
  });
});
