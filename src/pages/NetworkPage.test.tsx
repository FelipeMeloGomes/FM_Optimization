// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Rede Depois da separação, ela mostra só os scripts de
 * Internet/DNS Manager em cards de seção (o padrão das demais páginas). O
 * conteúdo de configuração de DNS vive em `DnsPage`. `useScriptPage`,
 * `use-is-script-applied` e `useDnsContext` são mockados na fronteira para
 * provar que a página não consome mais o contexto de DNS.
 */

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  execute: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  confirmExecute: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  activeExecution: null,
  execute: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
  confirmExecute: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: store.activeExecution,
    handleExecute: store.execute,
    handleCancel: store.cancel,
    handleConfirmExecute: store.confirmExecute,
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
  store.execute = vi.fn(async () => {});
  store.cancel = vi.fn(async () => {});
  store.confirmExecute = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('NetworkPage', () => {
  it('não mostra mais a configuração de DNS', () => {
    renderPage();

    expect(screen.queryByText('Configure seu DNS para melhor velocidade e privacidade')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Testar Novamente' })).toBeNull();
  });

  it('mostra o herói e as seções de scripts no padrão das outras páginas', () => {
    store.scripts = [
      script('internet-1', 'Ajustar TCP/IP'),
      script('dns-2', 'Restaurar pilha de rede', 'DNS Manager'),
    ];

    renderPage();

    expect(screen.getByText('Internet')).toBeDefined();
    expect(screen.getByText('TCP/IP e MTU')).toBeDefined();
    expect(screen.getByText('Reparo e diagnóstico')).toBeDefined();
    expect(screen.getByText('Ajustar TCP/IP')).toBeDefined();
    expect(screen.getByText('Restaurar pilha de rede')).toBeDefined();
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

  it('conta os tweaks por seção e não pelo catálogo inteiro', () => {
    store.scripts = [script('internet-1', 'Ajustar TCP/IP')];

    renderPage();

    expect(screen.getByText('1 tweaks')).toBeDefined();
    expect(screen.queryByText('17 tweaks')).toBeNull();
  });

  it('executa o script da seção chamando handleConfirmExecute com o script', () => {
    const internet = script('internet-1', 'Ajustar TCP/IP');
    store.scripts = [internet];

    renderPage();
    act(() => fireEvent.click(screen.getByRole('button', { name: /Executar/ })));

    expect(store.confirmExecute).toHaveBeenCalledWith(internet);
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
