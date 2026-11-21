// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Utilitários no padrão da Limpeza: uma única lista
 * virtualizada, sem cards nem agrupamento por seção, com seleção múltipla e
 * barra de lote. `use-script-page` é mockado na fronteira; o hook de seleção é o
 * real. Os testes ligam o que o usuário vê (linhas, contador, botão aplicar) ao
 * que é repassado ao `handleApply`.
 */

const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  activeExecution: null as string | null,
  handleCancel: vi.fn(),
  handleApply: vi.fn(),
  page: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: (category: string) => {
    store.page(category);
    return {
      state: store.state,
      categoryScripts: store.scripts,
      activeExecution: store.activeExecution,
      handleCancel: store.handleCancel,
      handleApply: store.handleApply,
      batch: null,
      confirmBulkScripts: [],
      setConfirmBulkScripts: () => {},
      handleConfirmBulk: () => {},
      failedScripts: [],
      clearFailures: () => {},
    };
  },
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

import UtilitiesPage from './UtilitiesPage';

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category: 'Utilities',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const FULL_CATALOG = [
  script('util-1', 'Relatório de Manutenção'),
  script('builtin-22', 'Limpeza de RAM'),
  script('builtin-27', 'Otimizar Processos'),
];

function bodyText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = FULL_CATALOG;
  store.activeExecution = null;
  store.handleCancel.mockClear();
  store.handleApply.mockClear();
  store.page.mockClear();
});

describe('UtilitiesPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.state = { status: 'loading' };

    render(<UtilitiesPage />);

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Ferramentas de manutenção e reparo')).toBeNull();
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.state = { status: 'error', error: 'catálogo indisponível' };

    const html = renderToStaticMarkup(<UtilitiesPage />).replace(/<!--.*?-->/g, '');
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    expect(text).toContain('Erro ao carregar tweaks');
    expect(text).toContain('catálogo indisponível');
  });
});

describe('UtilitiesPage — lista única no padrão da Limpeza', () => {
  it('pede ao hook a categoria Utilities', async () => {
    render(<UtilitiesPage />);

    await waitFor(() => expect(store.page).toHaveBeenCalledWith('Utilities'));
  });

  it('mostra o hero', async () => {
    render(<UtilitiesPage />);

    await waitFor(() =>
      expect(screen.getByText('Ferramentas de manutenção e reparo')).toBeDefined()
    );
  });

  it('renderiza uma única lista virtualizada, sem cards nem seções', async () => {
    render(<UtilitiesPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const list = screen.getByTestId('tweaks-list');

    expect(list.querySelector('ul')?.className).toContain('divide-y');
    expect(list.querySelectorAll('li[data-index]').length).toBe(3);
    expect(screen.queryByText('Manutenção do Sistema')).toBeNull();
    expect(screen.queryByText('Memória e Processos')).toBeNull();
  });

  it('mantém espaço entre a barra de seleção e a lista', async () => {
    render(<UtilitiesPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const list = screen.getByTestId('tweaks-list');
    const selectAll = screen.getByRole('checkbox', { name: /Selecionar todos/ });

    expect(list.parentElement?.className).toContain('space-y-6');
    expect(list.parentElement?.contains(selectAll)).toBe(true);
  });

  it('começa sem nada marcado e atualiza o contador ao marcar um tweak', async () => {
    render(<UtilitiesPage />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Selecionar Limpeza de RAM/ })).toBeDefined()
    );
    const checkbox = screen.getByRole('checkbox', {
      name: /Selecionar Limpeza de RAM/,
    }) as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    expect(bodyText()).toContain('0 de 3 selecionados');

    fireEvent.click(checkbox);

    expect(bodyText()).toContain('1 de 3 selecionados');
  });

  it('aplica apenas os tweaks selecionados', async () => {
    render(<UtilitiesPage />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Selecionar Limpeza de RAM/ })).toBeDefined()
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar Limpeza de RAM/ }));
    fireEvent.click(screen.getByRole('button', { name: /Aplicar selecionados/ }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    const applied = store.handleApply.mock.calls[0][0] as ScriptEntry[];
    expect(applied.map((s) => s.id)).toEqual(['builtin-22']);
  });

  it('seleciona todos os tweaks da lista', async () => {
    render(<UtilitiesPage />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Selecionar todos/ })).toBeDefined()
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar todos/ }));

    expect(bodyText()).toContain('3 de 3 selecionados');
  });
});
