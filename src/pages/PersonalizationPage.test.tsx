// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Personalização: hero, seções barra de tarefas/menus e
 * efeitos visuais, esqueleto e erro. `use-script-page` e `use-is-script-applied`
 * são mockados na fronteira.
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

import PersonalizationPage from './PersonalizationPage';

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
}));

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category: 'Personalização',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
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
  return text(renderToStaticMarkup(<PersonalizationPage />));
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
});

describe('PersonalizationPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const html = renderToStaticMarkup(<PersonalizationPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Aparência do Windows');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'falha ao ler catalogo' };

    const html = text(render());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('falha ao ler catalogo');
  });

  it('renderiza o herói e as duas seções com seus nomes', () => {
    store.scripts = [script('tweaks-1', 'Tarefa 1'), script('tweaks-2', 'Efeito 1')];

    const html = render();

    expect(html).toContain('Aparência do Windows');
    expect(html).toContain('Barra de tarefas e menus');
    expect(html).toContain('Efeitos visuais');
    expect(html).not.toContain('animate-pulse');
  });

  it('lista cada script com nome e descrição', () => {
    store.scripts = [script('tweaks-1', 'Tarefa 1')];

    const html = render();

    expect(html).toContain('Tarefa 1');
    expect(html).toContain('Tarefa 1 — desc');
  });
});
