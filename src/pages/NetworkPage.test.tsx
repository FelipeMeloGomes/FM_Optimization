// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Rede Depois da separação, ela mostra só os scripts de
 * Internet/DNS Manager em cards de seção (o padrão das demais páginas). O
 * conteúdo de configuração de DNS vive em `DnsPage`. `useScriptPage`,
 * `use-is-script-applied` e `useDnsContext` são mockados na fronteira para
 * provar que a página não consome mais o contexto de DNS.
 *
 * A página agora usa seleção múltipla: `use-script-page` expõe a API de lote
 * (`handleApply`, `batch`, …) e o hook de seleção é o real (não mockado).
 */

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  cancel: ReturnType<typeof vi.fn>;
  handleApply: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  activeExecution: null,
  cancel: vi.fn(async () => {}),
  handleApply: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: store.activeExecution,
    handleExecute: () => {},
    handleCancel: store.cancel,
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

vi.mock('../contexts/DnsContext', () => ({
  useDnsContext: () => {
    throw new Error('NetworkPage não deve consumir DnsContext');
  },
  DnsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NetworkPage from './NetworkPage';

function script(id: string, name: string, category = 'Internet'): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category,
    subcategory: '',
    content: '',
    extension: 'bat',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

function renderPage() {
  return render(<NetworkPage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.activeExecution = null;
  store.cancel = vi.fn(async () => {});
  store.handleApply = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('NetworkPage', () => {
  it('não mostra mais a configuração de DNS', () => {
    renderPage();

    expect(screen.queryByText('Configure seu DNS para melhor velocidade e privacidade')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Testar Novamente' })).toBeNull();
  });

  it('mostra o herói e os scripts em uma única lista sem seções', () => {
    store.scripts = [
      script('internet-1', 'Ajustar TCP/IP'),
      script('dns-2', 'Restaurar pilha de rede', 'DNS Manager'),
    ];

    renderPage();

    expect(screen.getByText('Internet')).toBeDefined();
    expect(screen.getByTestId('tweaks-list')).toBeDefined();
    expect(screen.getByText('Ajustar TCP/IP')).toBeDefined();
    expect(screen.getByText('Restaurar pilha de rede')).toBeDefined();
    expect(screen.queryByText('TCP/IP e MTU')).toBeNull();
    expect(screen.queryByText('Reparo e diagnóstico')).toBeNull();
  });

  it('não mostra mais a seção DNS e resolução', () => {
    renderPage();

    expect(screen.queryByText('DNS e resolução')).toBeNull();
    expect(
      screen.queryByText(
        'Scripts para trocar provedores DNS, ajustar cache e prioridade e limpar o cache do resolutor.'
      )
    ).toBeNull();
  });

  it('conta os tweaks da lista visível e não o catálogo inteiro', () => {
    store.scripts = [script('internet-1', 'Ajustar TCP/IP')];

    renderPage();

    expect(screen.getByText('0 de 1 selecionados')).toBeDefined();
    expect(screen.queryByText('0 de 17 selecionados')).toBeNull();
  });

  it('seleciona um tweak e aplica só ele pelo botão de lote', () => {
    const internet = script('internet-1', 'Ajustar TCP/IP');
    store.scripts = [internet];

    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ajustar TCP/IP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual([
      'internet-1',
    ]);
  });

  it('mantém "Reverter Internet" (internet-11) visível e selecionável', () => {
    const reverter = script('internet-11', 'Reverter Internet');
    store.scripts = [reverter];

    renderPage();

    expect(screen.getByTestId('tweaks-list')).toBeDefined();
    expect(screen.getByText('Reverter Internet')).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Reverter Internet' })).toBeDefined();
  });

  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Internet')).toBeNull();
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'falha ao ler catalogo' };

    renderPage();

    expect(screen.getByText('Erro ao carregar tweaks')).toBeDefined();
    expect(screen.getByText('falha ao ler catalogo')).toBeDefined();
  });
});
