import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

const THEME_BLOCKS = [
  ':root {',
  ':root.dark {',
  ':root.midnight {',
  ':root.amber {',
  ':root.emerald {',
  ':root.batman {',
];

describe('tokens semânticos dos temas', () => {
  it.each(['--color-success', '--color-warning', '--color-info', '--color-selection'])(
    'define %s em todos os temas',
    (token) => {
      for (const block of THEME_BLOCKS) {
        const start = css.indexOf(block);
        expect(start, `bloco ${block} não encontrado`).toBeGreaterThan(-1);
        const next = css.indexOf('\n}', start);
        expect(css.slice(start, next), `${token} ausente em ${block}`).toContain(token);
      }
    }
  );

  it.each(['#5a6a85', '#5a5a7a', '#8a7e6e', '#5a8a70', '#5a5868'])(
    'remove muted-foreground ilegível %s',
    (oldColor) => {
      expect(css).not.toContain(oldColor);
    }
  );

  it('ativa utilities dark: para todos os temas escuros', () => {
    const directive = css.match(/@custom-variant dark \(([^)]*)\)/)?.[1] ?? '';
    for (const theme of ['dark', 'midnight', 'amber', 'emerald', 'batman']) {
      expect(directive).toContain(`.${theme}`);
    }
  });

  it('declara color-scheme: light no tema Paper', () => {
    const start = css.indexOf(':root {');
    const next = css.indexOf('\n}', start);
    expect(css.slice(start, next)).toContain('color-scheme: light');
  });

  it('respeita prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
