// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/** A página Reparo do Sistema mostra só SFC, CHKDSK e DISM RestoreHealth. */
const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  handleApply: ReturnType<typeof vi.fn>;
  handleCancel: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  activeExecution: null,
  handleApply: vi.fn(),
  handleCancel: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: store.activeExecution,
    handleExecute: () => {},
    handleCancel: store.handleCancel,
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
  store.activeExecution = null;
  store.handleApply = vi.fn();
  store.handleCancel = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('SystemRepairPage', () => {
  it('mostra o banner ilustrado e o título da página', () => {
    renderPage();

    expect(screen.getByText('Reparo do Sistema')).toBeDefined();
    expect(screen.getByTestId('tweaks-list')).toBeDefined();
    expect(screen.queryByText('Integridade do sistema')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Ilustração de ferro de solda e placa em bancada' })
    ).toBeDefined();
  });

  it('marca um script de reparo e aplica só ele pelo botão de lote', () => {
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar SFC Scannow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual([
      'builtin-87',
    ]);
  });

  it('clicar em Cancelar com execução ativa ainda chama handleCancel', () => {
    store.activeExecution = 'builtin-87';
    store.scripts = [script('builtin-87', 'SFC Scannow')];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(store.handleCancel).toHaveBeenCalledWith('builtin-87');
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
