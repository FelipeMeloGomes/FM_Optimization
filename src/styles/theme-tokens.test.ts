import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HARDCODED_COLOR =
  /\b(?:text|bg|border|from|via|to|ring|fill|stroke|shadow)-(?:(?:amber|emerald|yellow|red|cyan|blue|violet|rose|orange|green|pink|indigo|sky|lime|teal|purple|fuchsia|gray|slate|zinc|neutral|stone)-\d{3}|(?:white|black)(?:\/\d+)?)\b/;

function listSources(directory: string, extension = '.tsx'): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSources(path, extension);
    return entry.name.endsWith(extension) && !entry.name.endsWith(`.test${extension}`)
      ? [path.slice(SOURCE.length + 1)]
      : [];
  });
}

/** Task 7: páginas, componentes e layout, exceto testes. */
const GUARDED_SOURCES = [
  ...listSources(resolve(SOURCE, 'pages')),
  ...listSources(resolve(SOURCE, 'components')),
  ...listSources(resolve(SOURCE, 'layout')),
].sort();

/** Task 9: todo TSX não-teste, incluindo hooks e contextos. */
const ALL_TSX = listSources(SOURCE).sort();
/** Configs em `lib` também pintam cards; o guard cobre `.ts` não-teste. */
const LIB_SOURCES = listSources(resolve(SOURCE, 'lib'), '.ts').sort();
const ELLIPSIS_IN_STRING = /['"`][^'"`\n]*\.\.\.[^'"`\n]*['"`]/;

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

const THEME_BLOCKS = [
  '@theme {',
  ':root {',
  ':root.dark {',
  ':root.midnight {',
  ':root.amber {',
  ':root.emerald {',
  ':root.batman {',
];

describe('tokens semânticos dos temas', () => {
  it.each([
    '--color-success',
    '--color-warning',
    '--color-info',
    '--color-selection',
    '--color-overlay',
  ])('define %s em todos os temas', (token) => {
    for (const block of THEME_BLOCKS) {
      const start = css.indexOf(block);
      expect(start, `bloco ${block} não encontrado`).toBeGreaterThan(-1);
      const next = css.indexOf('\n}', start);
      expect(css.slice(start, next), `${token} ausente em ${block}`).toContain(token);
    }
  });

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

describe('guard de cores fixas', () => {
  it.each(GUARDED_SOURCES)('%s usa apenas tokens de tema', (file) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');
    const match = source.match(HARDCODED_COLOR);

    expect(match, `cor fixa em ${file}: ${match?.join(', ')}`).toBeNull();
  });

  it.each(LIB_SOURCES)('%s usa apenas tokens de tema', (file) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');
    const match = source.match(HARDCODED_COLOR);

    expect(match, `cor fixa em ${file}: ${match?.join(', ')}`).toBeNull();
  });

  it.each([
    ['components/ui/dialog.tsx', 'bg-overlay/80'],
    ['components/CommandPalette.tsx', 'bg-overlay/50'],
  ])('%s usa o token de overlay no scrim', (file, className) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');

    expect(source).toContain(className);
    expect(source).not.toContain('bg-black/');
  });

  it.each(GUARDED_SOURCES)('%s não usa glow RGB fixo', (file) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');
    const match = source.match(/rgba?\(/);

    expect(match, `RGB fixo em ${file}: ${match?.join(', ')}`).toBeNull();
  });
});

describe('guard de tipografia e movimento', () => {
  it.each(ALL_TSX)('%s usa reticências tipográficas', (file) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');
    const match = source.match(ELLIPSIS_IN_STRING);

    expect(match, `...) em ${file}: ${match?.join(', ')}`).toBeNull();
  });

  it.each(ALL_TSX)('%s não usa transition-all', (file) => {
    const source = readFileSync(resolve(SOURCE, file), 'utf8');

    expect(source, `transition-all em ${file}`).not.toContain('transition-all');
  });

  it('respeita movimento reduzido também no CSS global', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('não fixa a classe dark no HTML inicial', () => {
    const html = readFileSync(resolve(SOURCE, '..', 'index.html'), 'utf8');

    expect(html).not.toContain('class="dark"');
  });
});
