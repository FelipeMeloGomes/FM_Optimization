// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Utilitários: herói, seções e filtro por SSD (scripts
 * só-SSD somem sem SSD). `use-script-page` e `use-is-script-applied` são
 * mockados na fronteira e `window.electronAPI.hasSSD` controla o estado de SSD.
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
  const api = {
    hasSSD: vi.fn(async () => false),
  };
  (window as unknown as { electronAPI?: { hasSSD: () => Promise<boolean> } }).electronAPI = api;
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
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

  it('renderiza o herói e as seis seções com seus nomes', () => {
    store.scripts = [script('util-1', 'Manutenção 1')];

    renderPage();

    expect(screen.getByText('Ferramentas de manutenção e reparo')).toBeDefined();
    expect(screen.getByText('Manutenção do Sistema')).toBeDefined();
    expect(screen.getByText('Armazenamento')).toBeDefined();
    expect(screen.getByText('Reparo do Sistema')).toBeDefined();
    expect(screen.getByText('Memória e Processos')).toBeDefined();
    expect(screen.getByText('Performance')).toBeDefined();
    expect(screen.getByText('Otimização Completa')).toBeDefined();
  });

  it('esconde scripts só-SSD quando não há SSD', async () => {
    store.scripts = [script('util-4', 'Só SSD'), script('builtin-88', 'Builtin SSD')];
    const api = (window as unknown as { electronAPI: { hasSSD: ReturnType<typeof vi.fn> } })
      .electronAPI;
    api.hasSSD.mockResolvedValue(false);

    renderPage();

    await screen.findByText('Armazenamento');
    expect(screen.queryByText('Só SSD')).toBeNull();
    expect(screen.queryByText('Builtin SSD')).toBeNull();
  });

  it('mostra scripts só-SSD quando há SSD', async () => {
    store.scripts = [script('util-4', 'Só SSD'), script('builtin-88', 'Builtin SSD')];
    const api = (window as unknown as { electronAPI: { hasSSD: ReturnType<typeof vi.fn> } })
      .electronAPI;
    api.hasSSD.mockResolvedValue(true);

    renderPage();

    await screen.findByText('Armazenamento');
    expect(screen.getByText('Só SSD')).toBeDefined();
    expect(screen.getByText('Builtin SSD')).toBeDefined();
  });
});
