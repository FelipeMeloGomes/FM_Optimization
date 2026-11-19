// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Utilitários: herói e as quatro seções restantes após
 * Armazenamento e Reparo do Sistema virarem páginas próprias. `use-script-page`
 * e `use-is-script-applied` são mockados na fronteira.
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

import UtilitiesPage from './UtilitiesPage';

const store = vi.hoisted<{
  page: AsyncState<{ scripts: ScriptEntry[] }>;
  scripts: ScriptEntry[];
}>(() => ({
  page: { status: 'success', data: { scripts: [] } },
  scripts: [],
}));

function script(id: string, name: string, requiresAdmin = false): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category: 'Utilities',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin,
    isBuiltIn: true,
    tags: [],
  };
}

function renderPage() {
  return render(<UtilitiesPage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: { scripts: [] } };
  store.scripts = [];
});

describe('UtilitiesPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    renderPage();

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Ferramentas de manutenção e reparo')).toBeNull();
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'catálogo indisponível' };

    const html = renderToStaticMarkup(<UtilitiesPage />).replace(/<!--.*?-->/g, '');
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    expect(text).toContain('Erro ao carregar tweaks');
    expect(text).toContain('catálogo indisponível');
  });

  it('renderiza o herói e apenas as duas seções restantes', () => {
    store.scripts = [script('util-1', 'Manutenção 1')];

    renderPage();

    expect(screen.getByText('Ferramentas de manutenção e reparo')).toBeDefined();
    expect(screen.getByText('Manutenção do Sistema')).toBeDefined();
    expect(screen.getByText('Memória e Processos')).toBeDefined();
    expect(screen.queryByText('Performance')).toBeNull();
    expect(screen.queryByText('Otimização Completa')).toBeNull();
    expect(screen.queryByText('Armazenamento')).toBeNull();
    expect(screen.queryByText('Reparo do Sistema')).toBeNull();
  });

  it('mostra os scripts restantes de cada seção', async () => {
    store.scripts = [
      script('util-1', 'Relatório de Manutenção'),
      script('builtin-22', 'Limpeza de RAM'),
    ];

    renderPage();

    await waitFor(() => expect(screen.getByText('Limpeza de RAM')).toBeDefined());
    expect(screen.getByText('Relatório de Manutenção')).toBeDefined();
  });
});
