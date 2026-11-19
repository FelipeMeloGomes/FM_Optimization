// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * A página Armazenamento mostra só os scripts da categoria homônima e mantém
 * o filtro de SSD que existia no cartão de Utilitários: sem SSD, os tweaks
 * exclusivos de SSD não aparecem.
 */
const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  confirmExecute: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  confirmExecute: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleConfirmExecute: store.confirmExecute,
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

import StoragePage from './StoragePage';

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category: 'Armazenamento',
    subcategory: '',
    content: '',
    extension: 'bat',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

function setHasSSD(value: boolean) {
  (window as unknown as { electronAPI?: { hasSSD: () => Promise<boolean> } }).electronAPI = {
    hasSSD: vi.fn(async () => value),
  };
}

function renderPage() {
  return render(<StoragePage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.confirmExecute = vi.fn();
  setHasSSD(true);
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('StoragePage', () => {
  it('mostra o banner animado e o título da página', () => {
    const { container } = renderPage();

    expect(screen.getByText('Armazenamento')).toBeDefined();
    expect(container.querySelector('[data-hero-animation="storage"]')).not.toBeNull();
  });

  it('mostra os scripts de armazenamento e executa o escolhido', async () => {
    const limpeza = script('util-2', 'Limpeza WinSxS');
    const trim = script('builtin-88', 'TRIM SSD');
    store.scripts = [limpeza, trim];

    renderPage();

    expect(screen.getByText('Limpeza WinSxS')).toBeDefined();
    await waitFor(() => expect(screen.getByText('TRIM SSD')).toBeDefined());
    const buttons = screen.getAllByRole('button', { name: 'Executar' });
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    expect(store.confirmExecute).toHaveBeenCalledWith(limpeza);
  });

  it('esconde os scripts exclusivos de SSD quando não há SSD', () => {
    setHasSSD(false);
    store.scripts = [
      script('util-2', 'Limpeza WinSxS'),
      script('util-4', 'Otimizar SSD'),
      script('builtin-88', 'TRIM SSD'),
    ];

    renderPage();

    expect(screen.getByText('Limpeza WinSxS')).toBeDefined();
    expect(screen.queryByText('Otimizar SSD')).toBeNull();
    expect(screen.queryByText('TRIM SSD')).toBeNull();
  });

  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Armazenamento')).toBeNull();
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'catálogo indisponível' };

    renderPage();

    expect(screen.getByText('Erro ao carregar tweaks')).toBeDefined();
    expect(screen.getByText('catálogo indisponível')).toBeDefined();
  });
});
