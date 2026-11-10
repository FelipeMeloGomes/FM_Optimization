// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, RestorePointEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Pontos de Restauração: estados de carregamento/erro
 * (com e sem admin), herói, criar ponto (input + Enter/botão), busca, tabela
 * de pontos, diálogos de exclusão e restauração. `useRestorePointContext` é
 * mockado na fronteira.
 */

vi.mock('../contexts/RestorePointContext', () => ({
  useRestorePointContext: () => store.restore,
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import RestorePointsPage from './RestorePointsPage';

const store = vi.hoisted<{
  restore: {
    state: AsyncState<RestorePointEntry[]>;
    creating: boolean;
    restoring: boolean;
    isAdmin: boolean;
    adminRequired: boolean;
    refresh: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
}>(() => ({
  restore: {
    state: { status: 'success', data: [rp()] },
    creating: false,
    restoring: false,
    isAdmin: true,
    adminRequired: false,
    refresh: vi.fn(),
    create: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
  },
}));

function rp(overrides: Partial<RestorePointEntry> = {}): RestorePointEntry {
  return {
    sequenceNumber: 1,
    description: 'Ponto antes do tweak',
    creationTime: '2026-01-05T10:00:00.000Z',
    eventType: 'Manual',
    ...overrides,
  };
}

function restore(overrides: Partial<typeof store.restore> = {}) {
  store.restore = {
    state: { status: 'success', data: [rp()] },
    creating: false,
    restoring: false,
    isAdmin: true,
    adminRequired: false,
    refresh: vi.fn(),
    create: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderPage() {
  return render(<RestorePointsPage />);
}

beforeEach(() => {
  restore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RestorePointsPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    restore({ state: { status: 'loading' } });

    renderPage();

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Pontos de Restauração do Sistema')).toBeNull();
  });

  it('mostra erro sem admin quando o acesso é negado', () => {
    restore({
      state: { status: 'error', error: 'Acesso negado' },
      isAdmin: false,
      adminRequired: true,
    });

    renderPage();

    expect(screen.getByText('Permissão de administrador necessária')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDefined();
  });

  it('mostra erro genérico quando não é problema de admin', () => {
    restore({
      state: { status: 'error', error: 'serviço indisponível' },
      isAdmin: true,
      adminRequired: false,
    });

    renderPage();

    expect(screen.getByText('Erro ao carregar pontos de restauração')).toBeDefined();
    expect(screen.getByText('serviço indisponível')).toBeDefined();
  });
});

describe('RestorePointsPage — conteúdo', () => {
  it('renderiza o herói, contador e o ponto existente', () => {
    renderPage();

    expect(screen.getByText('Pontos de Restauração do Sistema')).toBeDefined();
    expect(screen.getByText('1 pontos')).toBeDefined();
    expect(screen.getByText('Ponto antes do tweak')).toBeDefined();
    expect(screen.getByText('Manual')).toBeDefined();
  });

  it('mostra estado vazio quando não há pontos', () => {
    restore({ state: { status: 'success', data: [] } });

    renderPage();

    expect(screen.getByText('Nenhum ponto de restauração encontrado')).toBeDefined();
    expect(screen.getByText('Crie um ponto de restauração para começar')).toBeDefined();
  });

  it('filtra pontos pela busca', () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Buscar pontos de restauração...'), {
      target: { value: 'inexistente' },
    });

    expect(screen.getByText('Nenhum ponto encontrado para esta busca')).toBeDefined();
  });

  it('cria um ponto pelo input e pelo botão', async () => {
    const { create } = store.restore;

    renderPage();

    const input = screen.getByPlaceholderText('Nome do ponto de restauração...');
    act(() => fireEvent.change(input, { target: { value: 'Meu ponto' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Criar' })));

    await waitFor(() => expect(create).toHaveBeenCalledWith('Meu ponto'));
  });

  it('não cria ponto com nome vazio', () => {
    const { create } = store.restore;

    renderPage();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Criar' })));

    expect(create).not.toHaveBeenCalled();
  });

  it('abre o diálogo de exclusão e confirma a remoção', async () => {
    const { remove } = store.restore;

    renderPage();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Excluir o ponto/ })));

    expect(screen.getByText('Confirmar Exclusão')).toBeDefined();
    expect(
      screen.getByText(/Tem certeza que deseja excluir este ponto de restauração\?/)
    ).toBeDefined();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Excluir' })));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
  });

  it('cancela a exclusão sem chamar remove', () => {
    const { remove } = store.restore;

    renderPage();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Excluir o ponto/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })));

    expect(remove).not.toHaveBeenCalled();
  });

  it('abre o diálogo de restauração e confirma', async () => {
    const { restore: restoreFn } = store.restore;

    renderPage();

    act(() =>
      fireEvent.click(screen.getByRole('button', { name: /Restaurar sistema para o ponto/ }))
    );

    expect(screen.getByText('Confirmar Restauração')).toBeDefined();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Restaurar' })));

    await waitFor(() => expect(restoreFn).toHaveBeenCalledWith(1));
  });
});
