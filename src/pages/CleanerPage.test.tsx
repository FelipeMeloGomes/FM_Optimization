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
  virtual: null as null | { indices: number[]; paddingTop: number; paddingBottom: number },
  virtualCalls: [] as { scrollRef: unknown; rowHeight: unknown; listRef: unknown }[],
}));

vi.mock('../hooks/use-virtual-rows', () => ({
  useVirtualRows: <T,>(items: T[], scrollRef: unknown, rowHeight: unknown, listRef?: unknown) => {
    state.virtualCalls.push({ scrollRef, rowHeight, listRef });
    const config = state.virtual;
    const indices = config ? config.indices : items.map((_, index) => index);
    return {
      virtualItems: indices.map((index) => ({
        index,
        key: index,
        start: index * 72,
        end: (index + 1) * 72,
        size: 72,
        lane: 0,
      })),
      paddingTop: config?.paddingTop ?? 0,
      paddingBottom: config?.paddingBottom ?? 0,
      measureElement: () => {},
    };
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
  state.virtual = null;
  state.virtualCalls = [];
});

describe('CleanerPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    state.loading = true;

    const { container } = render(<CleanerPage />);

    expect(screen.getByRole('status', { name: 'Carregando itens de limpeza…' })).not.toBeNull();
    expect(container.querySelectorAll('[data-skeleton="row"]')).toHaveLength(6);
    expect(container.querySelector('[data-skeleton="refresh"]')).not.toBeNull();
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

  it('deixa o botão de atualizar fora do hero, com fundo opaco padronizado', () => {
    const { container } = render(<CleanerPage />);
    const hero = container.querySelector('.bg-gradient-to-br');
    const button = screen.getByRole('button', { name: 'Atualizar estatísticas' });

    expect(hero?.contains(button)).toBe(false);
    expect(screen.getByRole('group', { name: 'Atualizar dados' }).contains(button)).toBe(true);
    expect(button.className).toContain('bg-card');
    expect(button.className).not.toContain('bg-transparent');
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

  it('usa as cores do tema no ícone dos itens sem erro', () => {
    render(<CleanerPage />);

    const caixa = screen
      .getByText('Temp do Usuário')
      .closest('label')
      ?.querySelector('span.size-8');
    expect(caixa?.className).toContain('bg-primary/10');
    expect(caixa?.querySelector('svg')?.getAttribute('class')).toContain('text-primary');
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
    expect(screen.getByRole('group', { name: 'Atualizar dados' }).className).not.toContain('pb-6');

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

describe('CleanerPage — virtualização', () => {
  it('renderiza só as linhas visíveis devolvidas pelo virtualizador', () => {
    // Ordem padrão do beforeEach: Temp(0), Chrome(1), Firefox(2), Windows Update(3).
    state.virtual = { indices: [1], paddingTop: 72, paddingBottom: 144 };
    render(<CleanerPage />);

    expect(screen.getByText('Cache do Google Chrome')).not.toBeNull();
    expect(screen.queryByText('Temp do Usuário')).toBeNull();
    expect(screen.queryByText('Cache do Mozilla Firefox')).toBeNull();
  });

  it('mantém a altura total com espaçadores acima e abaixo das linhas visíveis', () => {
    state.virtual = { indices: [1, 2], paddingTop: 72, paddingBottom: 144 };
    const { container } = render(<CleanerPage />);

    const top = container.querySelector('[data-testid="virtual-spacer-top"]');
    const bottom = container.querySelector('[data-testid="virtual-spacer-bottom"]');
    expect((top as HTMLElement).style.height).toBe('72px');
    expect((bottom as HTMLElement).style.height).toBe('144px');
  });

  it('a linha virtualizada continua permitindo selecionar o item', async () => {
    state.virtual = { indices: [1], paddingTop: 72, paddingBottom: 144 };
    render(<CleanerPage />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Selecionar Cache do Google Chrome') as HTMLInputElement).checked
      ).toBe(true)
    );

    fireEvent.click(screen.getByLabelText('Selecionar Cache do Google Chrome'));

    expect(
      (screen.getByLabelText('Selecionar Cache do Google Chrome') as HTMLInputElement).checked
    ).toBe(false);
  });

  it('usa a rolagem da página, sem container de scroll próprio', () => {
    const { container } = render(<CleanerPage />);

    expect(state.virtualCalls[0]?.scrollRef).toBeNull();
    expect(state.virtualCalls[0]?.listRef).not.toBeNull();

    const list = container.querySelector('[data-testid="cleaner-list"]');
    expect(list).not.toBeNull();
    expect(list?.className).not.toContain('overflow-y-auto');
    expect(list?.className).not.toContain('max-h-');
  });

  it('expõe data-index na linha medida para o virtualizador não reclamar', () => {
    state.virtual = { indices: [1], paddingTop: 72, paddingBottom: 144 };
    render(<CleanerPage />);

    const row = screen.getByText('Cache do Google Chrome').closest('li');
    expect(row?.getAttribute('data-index')).toBe('1');
  });
});

describe('CleanerPage — selecionar recomendados', () => {
  const checked = (label: string) =>
    (screen.getByLabelText(`Selecionar ${label}`) as HTMLInputElement).checked;

  it('marca temps, prefetch e caches dos navegadores, ignorando os demais', async () => {
    const update = item({
      id: 'windows-update',
      label: 'Cache do Windows Update',
      group: 'atualizacoes',
      requiresAdmin: true,
      fileCount: 12,
      totalSizeBytes: 90 * 1024 * 1024,
    });
    state.items = [
      item(),
      item({
        id: 'temp-windows',
        label: 'Temp do Windows',
        requiresAdmin: true,
        fileCount: 40,
        totalSizeBytes: GB / 2,
      }),
      item({
        id: 'prefetch',
        label: 'Prefetch',
        requiresAdmin: true,
        fileCount: 20,
        totalSizeBytes: GB / 4,
      }),
      item({
        id: 'chrome',
        label: 'Cache do Google Chrome',
        group: 'navegadores',
        fileCount: 890,
        totalSizeBytes: 180 * 1024 * 1024,
      }),
      item({
        id: 'edge',
        label: 'Cache do Microsoft Edge',
        group: 'navegadores',
        fileCount: 50,
        totalSizeBytes: 50 * 1024 * 1024,
      }),
      item({
        id: 'brave',
        label: 'Cache do Brave',
        group: 'navegadores',
        fileCount: 10,
        totalSizeBytes: 10 * 1024 * 1024,
      }),
      item({
        id: 'firefox',
        label: 'Cache do Mozilla Firefox',
        group: 'navegadores',
        fileCount: 0,
        totalSizeBytes: 0,
      }),
      update,
    ];

    render(<CleanerPage />);
    await waitFor(() => expect(checked('Temp do Usuário')).toBe(true));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(checked('Temp do Usuário')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar recomendados' }));

    expect(checked('Temp do Usuário')).toBe(true);
    expect(checked('Temp do Windows')).toBe(true);
    expect(checked('Prefetch')).toBe(true);
    expect(checked('Cache do Google Chrome')).toBe(true);
    expect(checked('Cache do Microsoft Edge')).toBe(true);
    expect(checked('Cache do Brave')).toBe(true);
    expect(checked('Cache do Mozilla Firefox')).toBe(false);
    expect(checked('Cache do Windows Update')).toBe(false);
  });

  it('sem admin marca só os recomendados que podem ser limpos', async () => {
    state.isAdmin = false;
    state.items = [
      item(),
      item({
        id: 'temp-windows',
        label: 'Temp do Windows',
        requiresAdmin: true,
        fileCount: 40,
        totalSizeBytes: GB / 2,
      }),
      item({
        id: 'prefetch',
        label: 'Prefetch',
        requiresAdmin: true,
        fileCount: 20,
        totalSizeBytes: GB / 4,
      }),
    ];

    render(<CleanerPage />);
    await waitFor(() => expect(checked('Temp do Usuário')).toBe(true));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar recomendados' }));

    expect(checked('Temp do Usuário')).toBe(true);
    expect(checked('Temp do Windows')).toBe(false);
    expect(checked('Prefetch')).toBe(false);
  });

  it('avisa quando nenhum recomendado está disponível', async () => {
    state.isAdmin = false;
    state.items = [
      item({
        id: 'temp-windows',
        label: 'Temp do Windows',
        requiresAdmin: true,
        fileCount: 40,
        totalSizeBytes: GB / 2,
      }),
    ];

    render(<CleanerPage />);
    await waitFor(() => expect(screen.getByText('0 de 0 selecionados')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar recomendados' }));

    expect(state.toasts[0]).toMatchObject({
      type: 'info',
      title: 'Nenhum item recomendado',
    });
  });
});
