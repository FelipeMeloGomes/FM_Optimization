// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Personalização: hero, seções barra de tarefas/menus e
 * efeitos visuais, esqueleto e erro. `use-script-page` e `use-is-script-applied`
 * são mockados na fronteira.
 *
 * A página agora usa seleção múltipla: `use-script-page` expõe a API de lote
 * (`handleApply`, `batch`, …) e o hook de seleção é o real (não mockado).
 */

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleApply: store.handleApply,
    batch: null,
    confirmBulkScripts: [],
    setConfirmBulkScripts: () => {},
    handleConfirmBulk: () => {},
    failedScripts: [],
    clearFailures: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

import PersonalizationPage from './PersonalizationPage';

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  handleApply: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  handleApply: vi.fn(),
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

function renderStatic(): string {
  return text(renderToStaticMarkup(<PersonalizationPage />));
}

function renderPage() {
  return render(<PersonalizationPage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.handleApply = vi.fn();
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

    const html = text(renderStatic());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('falha ao ler catalogo');
  });

  it('renderiza o herói e as seções com seus nomes', () => {
    store.scripts = [script('tweaks-1', 'Tarefa 1'), script('tweaks-2', 'Efeito 1')];

    const html = renderStatic();

    expect(html).toContain('Aparência e mods de apps');
    expect(html).toContain('Barra de tarefas e menus');
    expect(html).toContain('Efeitos visuais');
    expect(html).toContain('Discord');
    expect(html).toContain('Spotify');
    expect(html).not.toContain('animate-pulse');
  });

  it('lista cada script com nome e descrição', () => {
    store.scripts = [script('tweaks-1', 'Tarefa 1')];

    const html = renderStatic();

    expect(html).toContain('Tarefa 1');
    expect(html).toContain('Tarefa 1 — desc');
  });

  it('mantém o script interativo apps-4 (Equicord) visível e selecionável', () => {
    const equicord = script('apps-4', 'Equicord');
    store.scripts = [equicord];

    renderPage();

    expect(screen.getByText('Equicord')).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Equicord' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['apps-4']);
  });

  it('aplica apenas o tweak marcado ao clicar em Aplicar selecionados', () => {
    const tarefa = script('tweaks-1', 'Tarefa 1');
    store.scripts = [tarefa];

    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Tarefa 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['tweaks-1']);
  });

  it('o botão Aplicar selecionados começa desabilitado com nada marcado', () => {
    store.scripts = [script('tweaks-1', 'Tarefa 1')];

    renderPage();

    const botao = screen.getByRole('button', { name: 'Aplicar selecionados' });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
  });
});
