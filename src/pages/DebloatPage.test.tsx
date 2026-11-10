// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Debloat: hero, seções de bloatware/Discord/Spotify,
 * esqueleto de carregamento e erro. `use-script-page` e `use-is-script-applied`
 * são mockados na fronteira; o componente, as seções e a montagem são reais.
 */

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleConfirmExecute: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import DebloatPage from './DebloatPage';

const store = vi.hoisted<{ page: AsyncState<ScriptEntry[]>; scripts: ScriptEntry[] }>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
}));

function script(id: string, name: string, category = 'Debloat'): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category,
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [] as string[],
  };
}

function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(): string {
  return text(renderToStaticMarkup(<DebloatPage />));
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
});

describe('DebloatPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const html = renderToStaticMarkup(<DebloatPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Debloat do sistema e dos apps');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'scripts.json ilegível' };

    const html = text(render());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('scripts.json ilegível');
  });

  it('renderiza o herói e as três seções com seus nomes', () => {
    store.scripts = [
      script('apps-3', 'App 1'),
      script('builtin-14', 'App 2'),
      script('apps-4', 'Discord'),
      script('apps-5', 'Reverter Discord'),
      script('apps-6', 'Spotify'),
      script('apps-7', 'Reverter Spotify'),
    ];

    const html = render();

    expect(html).toContain('Debloat do sistema e dos apps');
    expect(html).toContain('Remova o bloatware pré-instalado');
    expect(html).toContain('Remover Bloatware');
    expect(html).toContain('Discord');
    expect(html).toContain('Spotify');
    expect(html).not.toContain('animate-pulse');
  });

  it('lista cada script da seção com nome e descrição', () => {
    store.scripts = [script('apps-3', 'Remover Bloatware')];

    const html = render();

    expect(html).toContain('Remover Bloatware');
    expect(html).toContain('Remover Bloatware — desc');
  });
});
