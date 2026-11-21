// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * A página Armazenamento mostra só os scripts da categoria homônima e mantém
 * o filtro de SSD que existia no cartão de Utilitários: sem SSD, os tweaks
 * exclusivos de SSD não aparecem.
 *
 * A página agora usa seleção múltipla: `use-script-page` expõe a API de lote
 * (`handleApply`, `batch`, …) e o hook de seleção é o real (não mockado). Os
 * ids que somem do catálogo (filtro de `hasSSD`) saem da seleção e da contagem.
 */
const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  handleApply: ReturnType<typeof vi.fn>;
  handleCancel: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  handleApply: vi.fn(),
  handleCancel: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
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
  store.handleApply = vi.fn();
  store.handleCancel = vi.fn();
  setHasSSD(true);
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('StoragePage', () => {
  it('mostra o banner animado e o título da página', () => {
    const { container } = renderPage();

    expect(screen.getByText('Armazenamento')).toBeDefined();
    expect(screen.getByTestId('tweaks-list')).toBeDefined();
    expect(screen.queryByText('Otimização de armazenamento')).toBeNull();
    expect(container.querySelector('[data-hero-animation="storage"]')).not.toBeNull();
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

  it('seleciona um tweak e aplica só ele pelo botão de lote', async () => {
    const limpeza = script('util-2', 'Limpeza WinSxS');
    store.scripts = [limpeza];

    renderPage();

    await waitFor(() => expect(screen.getByText('Limpeza WinSxS')).toBeDefined());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Limpeza WinSxS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['util-2']);
  });

  it('remove da seleção e do contador um tweak que sai do catálogo', async () => {
    const limpeza = script('util-2', 'Limpeza WinSxS');
    const outro = script('util-5', 'Outro tweak de armazenamento');
    store.scripts = [limpeza, outro];

    const { unmount } = renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Limpeza WinSxS' }));
    expect(screen.getByText('1 de 2 selecionados')).toBeDefined();

    // Rerender com o id marcado removido do catálogo (filtro de SSD mudou).
    unmount();
    store.scripts = [outro];
    renderPage();

    expect(screen.getByText('0 de 1 selecionados')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(store.handleApply).not.toHaveBeenCalled();
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
