// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/** A página Reparo do Sistema mostra só SFC, CHKDSK e DISM RestoreHealth. */
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

import SystemRepairPage from './SystemRepairPage';

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category: 'Reparo do Sistema',
    subcategory: '',
    content: '',
    extension: 'bat',
    requiresAdmin: true,
    isBuiltIn: true,
    tags: [],
  };
}

function renderPage() {
  return render(<SystemRepairPage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.confirmExecute = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('SystemRepairPage', () => {
  it('mostra o banner animado e o título da página', () => {
    const { container } = renderPage();

    expect(screen.getByText('Reparo do Sistema')).toBeDefined();
    expect(container.querySelector('[data-hero-animation="repair"]')).not.toBeNull();
  });

  it('mostra os três scripts de reparo e executa o escolhido', () => {
    const sfc = script('builtin-87', 'SFC Scannow');
    store.scripts = [
      sfc,
      script('builtin-40', 'CHKDSK (Verificar Disco)'),
      script('builtin-64', 'DISM RestoreHealth'),
    ];

    renderPage();

    expect(screen.getByText('SFC Scannow')).toBeDefined();
    expect(screen.getByText('CHKDSK (Verificar Disco)')).toBeDefined();
    expect(screen.getByText('DISM RestoreHealth')).toBeDefined();
    const buttons = screen.getAllByRole('button', { name: 'Executar' });
    expect(buttons).toHaveLength(3);
    buttons[0].click();
    expect(store.confirmExecute).toHaveBeenCalledWith(sfc);
  });

  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Reparo do Sistema')).toBeNull();
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'catálogo indisponível' };

    renderPage();

    expect(screen.getByText('Erro ao carregar tweaks')).toBeDefined();
    expect(screen.getByText('catálogo indisponível')).toBeDefined();
  });
});
