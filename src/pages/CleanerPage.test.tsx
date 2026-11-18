// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CleanerItemStats, CleanItemsResult } from '../../electron/shared/ipc-types';

/**
 * A página de limpeza lista um item por linha, com seleção individual e um
 * botão único. Os testes cobrem o que a pessoa vê e o que é enviado ao main:
 * itens e tamanhos, seleção padrão, execução com os ids certos, itens de
 * sistema bloqueados sem admin e a confirmação opcional.
 */

const state = vi.hoisted(() => ({
  items: [] as CleanerItemStats[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastRefreshed: 0,
  refresh: vi.fn(async () => {}),
  clean: vi.fn<(ids: string[]) => Promise<CleanItemsResult>>(),
  toasts: [] as { type: string; title: string; description?: string }[],
  isAdmin: true,
  confirmOnExecute: false,
  autoClean: {
    status: { settings: { pending: [] as string[] }, running: false, isAdmin: true },
    runPending: vi.fn(async () => ({ ran: [], pending: [], failed: [] })),
    discard: vi.fn(async () => {}),
    relaunchAsAdmin: vi.fn(async () => ({ launched: true, cancelled: false })),
  },
}));

vi.mock('../hooks/use-cleaner-items', () => ({
  useCleanerItems: () => ({
    items: state.items,
    loading: state.loading,
    error: state.error,
    isRefreshing: state.isRefreshing,
    lastRefreshed: state.lastRefreshed,
    refresh: state.refresh,
    clean: state.clean,
  }),
}));

vi.mock('../components/EnhancedToast', () => ({
  showEnhancedToast: (options: { type: string; title: string; description?: string }) => {
    state.toasts.push(options);
  },
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: { soundEnabled: false, confirmOnExecute: state.confirmOnExecute },
  }),
}));

vi.mock('../contexts/AutoCleanContext', () => ({
  useAutoCleanContext: () => state.autoClean,
}));

import CleanerPage from './CleanerPage';

function item(overrides: Partial<CleanerItemStats> = {}): CleanerItemStats {
  return {
    id: 'temp-user',
    label: 'Temp do Usuário',
    description: 'Arquivos temporários criados pelos seus programas.',
    group: 'sistema',
    requiresAdmin: false,
    fileCount: 1200,
    totalSizeBytes: 2 * 1024 * 1024 * 1024,
    ...overrides,
  };
}

const GB = 1024 * 1024 * 1024;

function cleanResult(freedBytes: number, removedFiles: number): CleanItemsResult {
  return {
    items: [{ id: 'temp-user', label: 'Temp do Usuário', freedBytes, removedFiles }],
    freedBytes,
    removedFiles,
    failed: 0,
  };
}

beforeEach(() => {
  state.items = [
    item(),
    item({
      id: 'chrome',
      label: 'Cache do Google Chrome',
      description: 'Cache de páginas, imagens e scripts do Chrome.',
      group: 'navegadores',
      fileCount: 890,
      totalSizeBytes: 180 * 1024 * 1024,
    }),
    item({
      id: 'firefox',
      label: 'Cache do Mozilla Firefox',
      group: 'navegadores',
      fileCount: 0,
      totalSizeBytes: 0,
    }),
    item({
      id: 'windows-update',
      label: 'Cache do Windows Update',
      description: 'Instaladores já baixados.',
      group: 'atualizacoes',
      requiresAdmin: true,
      fileCount: 12,
      totalSizeBytes: 90 * 1024 * 1024,
    }),
  ];
  state.loading = false;
  state.error = null;
  state.isRefreshing = false;
  state.lastRefreshed = Date.now() - 60_000;
  state.isAdmin = true;
  state.confirmOnExecute = false;
  state.toasts = [];
  state.refresh.mockClear();
  state.clean.mockReset();
  state.clean.mockImplementation(async (ids) => {
    const freed = ids.includes('temp-user') ? 2 * GB : 0;
    return cleanResult(freed, freed > 0 ? 1200 : 0);
  });
  state.autoClean = {
    status: { settings: { pending: [] }, running: false, isAdmin: true },
    runPending: vi.fn(async () => ({ ran: [], pending: [], failed: [] })),
    discard: vi.fn(async () => {}),
    relaunchAsAdmin: vi.fn(async () => ({ launched: true, cancelled: false })),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    isAdmin: vi.fn(async () => state.isAdmin),
    onScriptEnded: () => () => {},
  };
});

describe('CleanerPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    state.loading = true;

    const { container } = render(<CleanerPage />);

    expect(screen.getByRole('status')).not.toBeNull();
    expect(container.innerHTML).toContain('animate-pulse');
    expect(screen.queryByText('Mantenha seu Windows limpo e rápido')).toBeNull();
  });

  it('mostra o erro quando a varredura falha e não há dados', () => {
    state.items = [];
    state.error = 'acesso negado';

    render(<CleanerPage />);

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar itens de limpeza');
    expect(screen.getByText('acesso negado')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).not.toBeNull();
  });

  it('mantém a lista e avisa quando só a atualização falha', () => {
    state.error = 'rede fora';

    render(<CleanerPage />);

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível atualizar');
    expect(screen.getByText('Temp do Usuário')).not.toBeNull();
  });
});

describe('CleanerPage — lista de itens', () => {
  it('mostra um item por linha, com tamanho e contagem de arquivos', () => {
    render(<CleanerPage />);

    expect(screen.getByText('Temp do Usuário')).not.toBeNull();
    expect(screen.getByText('Cache do Google Chrome')).not.toBeNull();
    expect(screen.getByText('Cache do Mozilla Firefox')).not.toBeNull();
    expect(screen.getByText('Cache do Windows Update')).not.toBeNull();

    expect(screen.getByText('2 GB')).not.toBeNull();
    expect(screen.getByText('1.200 arquivos')).not.toBeNull();
    expect(screen.getByText('Nada para limpar')).not.toBeNull();
  });

  it('mostra o total de arquivos e o horário da última atualização', () => {
    render(<CleanerPage />);

    expect(screen.getByText(/Atualizado há 1 min/)).not.toBeNull();
    expect(screen.getByText(/2\.102 arquivos/)).not.toBeNull();
  });

  it('desabilita a seleção de itens com 0 bytes', () => {
    render(<CleanerPage />);

    const checkbox = screen.getByLabelText('Selecionar Cache do Mozilla Firefox');
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
  });

  it('marca por padrão todos os itens que têm dados', async () => {
    render(<CleanerPage />);

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Selecionar Temp do Usuário') as HTMLInputElement).checked
      ).toBe(true);
    });

    expect(
      (screen.getByLabelText('Selecionar Cache do Windows Update') as HTMLInputElement).checked
    ).toBe(true);
    expect(
      (screen.getByLabelText('Selecionar Cache do Mozilla Firefox') as HTMLInputElement).checked
    ).toBe(false);
  });
});

describe('CleanerPage — seleção e execução', () => {
  it('desmarca tudo pelo controle geral e desabilita o botão', async () => {
    render(<CleanerPage />);

    await waitFor(() => expect(screen.getByText('3 de 3 selecionados')).not.toBeNull());

    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar todos/ }));

    expect(screen.getByText('0 de 3 selecionados')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: /Limpar selecionados/ }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('limpa só o item desmarcado da seleção', async () => {
    render(<CleanerPage />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Selecionar Temp do Usuário') as HTMLInputElement).checked
      ).toBe(true)
    );

    fireEvent.click(screen.getByLabelText('Selecionar Temp do Usuário'));
    fireEvent.click(screen.getByRole('button', { name: /Limpar selecionados/ }));

    await waitFor(() => expect(state.clean).toHaveBeenCalledTimes(1));
    expect(state.clean).toHaveBeenCalledWith(['chrome', 'windows-update']);
  });

  it('mostra o resumo do que foi liberado e atualiza as estatísticas', async () => {
    render(<CleanerPage />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Selecionar Temp do Usuário') as HTMLInputElement).checked
      ).toBe(true)
    );

    fireEvent.click(screen.getByLabelText('Selecionar Cache do Google Chrome'));
    fireEvent.click(screen.getByLabelText('Selecionar Cache do Windows Update'));
    fireEvent.click(screen.getByRole('button', { name: /Limpar selecionados/ }));

    await waitFor(() => expect(state.toasts).toHaveLength(1));
    expect(state.toasts[0]).toMatchObject({ type: 'success', title: 'Limpeza concluída' });
    expect(state.toasts[0].description).toContain('Liberado: 2 GB');
    expect(state.refresh).toHaveBeenCalled();
  });

  it('mostra erro quando o main recusa a limpeza', async () => {
    state.clean.mockImplementation(async () => {
      throw 'Requer administrador: Temp do Usuário. Reinicie o app como administrador.';
    });

    render(<CleanerPage />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Selecionar Temp do Usuário') as HTMLInputElement).checked
      ).toBe(true)
    );

    fireEvent.click(screen.getByLabelText('Selecionar Cache do Google Chrome'));
    fireEvent.click(screen.getByLabelText('Selecionar Cache do Windows Update'));
    fireEvent.click(screen.getByRole('button', { name: /Limpar selecionados/ }));

    await waitFor(() => expect(state.toasts).toHaveLength(1));
    expect(state.toasts[0]).toMatchObject({ type: 'error', title: 'Falha na limpeza' });
    expect(state.toasts[0].description).toContain('Requer administrador');
  });

  it('pede confirmação antes de limpar quando a opção está ligada', async () => {
    state.confirmOnExecute = true;

    render(<CleanerPage />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Selecionar Temp do Usuário') as HTMLInputElement).checked
      ).toBe(true)
    );

    fireEvent.click(screen.getByRole('button', { name: /Limpar selecionados/ }));

    expect(screen.getByText('Confirmar limpeza')).not.toBeNull();
    expect(state.clean).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    await waitFor(() => expect(state.clean).toHaveBeenCalledTimes(1));
  });
});

describe('CleanerPage — administrador e pendências', () => {
  it('bloqueia itens de sistema sem admin e oferece reiniciar elevado', async () => {
    state.isAdmin = false;

    render(<CleanerPage />);

    expect(screen.getByText(/exigem administrador/)).not.toBeNull();

    const updateCheckbox = screen.getByLabelText(
      'Selecionar Cache do Windows Update'
    ) as HTMLInputElement;
    await waitFor(() => expect(updateCheckbox.disabled).toBe(true));
    expect(updateCheckbox.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Reiniciar como admin/ }));
    expect(state.autoClean.relaunchAsAdmin).toHaveBeenCalled();
  });

  it('mostra a seção de limpezas pendentes sem interferir na lista', () => {
    state.autoClean.status = {
      settings: { pending: ['cleaner-1'] },
      running: false,
      isAdmin: false,
    };

    render(<CleanerPage />);

    expect(screen.getByText('1 limpeza(s) automática(s) aguardando administrador')).not.toBeNull();
    expect(screen.getByText('Limpeza Rápida')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Executar agora' })).not.toBeNull();
    expect(screen.getByText('Temp do Usuário')).not.toBeNull();
  });
});
