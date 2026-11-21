// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppxInventory,
  AppxPackageInfo,
  AppxRemoveResult,
} from '../../electron/shared/ipc-types';

/**
 * A página Debloat é um inventário: uma linha por app Appx, com busca, abas,
 * seleção individual/em lote e remoção confirmada. Os testes cobrem o que a
 * pessoa vê e o que é enviado ao main (famílias, nunca comandos).
 */

const XBOX = 'Microsoft.XboxGamingOverlay_8wekyb3d8bbwe';
const STORE = 'Microsoft.WindowsStore_8wekyb3d8bbwe';
const GAME_BAR = 'Microsoft.XboxGamingOverlay';

const state = vi.hoisted(() => ({
  inventory: null as AppxInventory | null,
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastRefreshed: 0,
  refresh: vi.fn(async () => {}),
  remove: vi.fn<(families: string[]) => Promise<AppxRemoveResult>>(),
  toasts: [] as { type: string; title: string; description?: string }[],
  confirmOnExecute: true,
  elevate: vi.fn(async () => ({ launched: true, cancelled: false })),
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
        start: index * 69,
        end: (index + 1) * 69,
        size: 69,
        lane: 0,
      })),
      paddingTop: config?.paddingTop ?? 0,
      paddingBottom: config?.paddingBottom ?? 0,
      measureElement: () => {},
    };
  },
}));

vi.mock('../hooks/use-appx-inventory', () => ({
  useAppxInventory: () => ({
    inventory: state.inventory,
    loading: state.loading,
    error: state.error,
    isRefreshing: state.isRefreshing,
    lastRefreshed: state.lastRefreshed,
    refresh: state.refresh,
    remove: state.remove,
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

import DebloatPage from './DebloatPage';

function app(overrides: Partial<AppxPackageInfo> = {}): AppxPackageInfo {
  return {
    familyName: XBOX,
    packageName: GAME_BAR,
    displayName: 'Xbox Game Bar',
    version: '1.0.0.0',
    publisher: 'CN=Microsoft',
    isFramework: false,
    isProvisioned: false,
    removable: true,
    recommended: true,
    ...overrides,
  };
}

const PROTECTED_STORE = app({
  familyName: STORE,
  packageName: 'Microsoft.WindowsStore',
  displayName: 'Microsoft Store',
  removable: false,
  protectionReason: 'Componente essencial do Windows',
  recommended: false,
});

const SOLITAIRE = app({
  familyName: 'Microsoft.MicrosoftSolitaireCollection_8wekyb3d8bbwe',
  packageName: 'Microsoft.MicrosoftSolitaireCollection',
  displayName: 'Paciência',
  recommended: false,
});

const PHOTOS = app({
  familyName: 'Microsoft.Windows.Photos_8wekyb3d8bbwe',
  packageName: 'Microsoft.Windows.Photos',
  displayName: 'Fotos',
  recommended: false,
});

function inventory(packages: AppxPackageInfo[], elevated = true): AppxInventory {
  return { packages, elevated, scannedAt: 1000 };
}

beforeEach(() => {
  state.inventory = inventory([app(), PROTECTED_STORE, SOLITAIRE, PHOTOS]);
  state.loading = false;
  state.error = null;
  state.isRefreshing = false;
  state.lastRefreshed = 0;
  state.confirmOnExecute = true;
  state.toasts = [];
  state.refresh.mockClear();
  state.remove.mockReset();
  state.remove.mockResolvedValue({ removed: [XBOX], failed: [] });
  state.elevate.mockClear();
  state.virtual = null;
  state.virtualCalls = [];
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    elevateApp: state.elevate,
  };
});

describe('DebloatPage — carregamento e erro', () => {
  it('mostra o esqueleto enquanto o inventário carrega', () => {
    state.loading = true;
    state.inventory = null;

    const { container } = render(<DebloatPage />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Debloat de apps do Windows')).toBeNull();
  });

  it('mostra o erro e permite tentar de novo', () => {
    state.error = 'PowerShell indisponível';
    state.inventory = null;

    render(<DebloatPage />);

    expect(screen.getByText('Erro ao carregar o inventário de apps')).not.toBeNull();
    expect(screen.getByText('PowerShell indisponível')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('DebloatPage — inventário', () => {
  it('lista uma linha por app com nome, pacote e selo de protegido', () => {
    render(<DebloatPage />);

    expect(screen.getByText('Debloat de apps do Windows')).not.toBeNull();
    expect(screen.getByText('Xbox Game Bar')).not.toBeNull();
    expect(screen.getAllByText(GAME_BAR).length).toBeGreaterThan(0);
    expect(screen.getByText('Microsoft Store')).not.toBeNull();
    expect(screen.getByText('Protegido')).not.toBeNull();

    // Protegidos aparecem, mas não ganham checkbox.
    expect(screen.getByLabelText('Selecionar Xbox Game Bar')).not.toBeNull();
    expect(screen.queryByLabelText('Selecionar Microsoft Store')).toBeNull();
  });

  it('busca por nome ou package family', () => {
    render(<DebloatPage />);

    const search = screen.getByLabelText('Buscar apps');
    fireEvent.change(search, { target: { value: 'fotos' } });

    expect(screen.getByText('Fotos')).not.toBeNull();
    expect(screen.queryByText('Xbox Game Bar')).toBeNull();

    fireEvent.change(search, { target: { value: 'XboxGamingOverlay' } });
    expect(screen.getByText('Xbox Game Bar')).not.toBeNull();
    expect(screen.queryByText('Fotos')).toBeNull();
  });

  it('filtra pelas abas Recomendados e Protegidos', () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByRole('tab', { name: /Recomendados/ }));
    expect(screen.getByText('Xbox Game Bar')).not.toBeNull();
    expect(screen.queryByText('Paciência')).toBeNull();
    expect(screen.queryByText('Microsoft Store')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Protegidos/ }));
    expect(screen.getByText('Microsoft Store')).not.toBeNull();
    expect(screen.queryByText('Xbox Game Bar')).toBeNull();
  });

  it('mostra estado vazio quando a busca não encontra nada', () => {
    render(<DebloatPage />);

    fireEvent.change(screen.getByLabelText('Buscar apps'), {
      target: { value: 'app que não existe' },
    });

    expect(screen.getByText('Nenhum app encontrado')).not.toBeNull();
  });

  it('atualiza o inventário pelo botão do herói', () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar inventário' }));

    expect(state.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('DebloatPage — seleção e remoção', () => {
  it('seleciona ao clicar na linha do app, não só no checkbox', () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByText('Xbox Game Bar'));

    expect(screen.getByLabelText('Selecionar Xbox Game Bar')).toHaveProperty('checked', true);
    expect(screen.getByText('1 selecionado')).not.toBeNull();
  });

  it('seleciona individualmente e conta os selecionados', () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    expect(screen.getByText('1 selecionado')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Selecionar Paciência'));
    expect(screen.getByText('2 selecionados')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    expect(screen.getByText('1 selecionado')).not.toBeNull();
  });

  it('"Selecionar recomendados" marca apenas os recomendados presentes', () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar recomendados' }));

    expect(screen.getByText('1 selecionado')).not.toBeNull();
    expect(screen.getByLabelText('Selecionar Xbox Game Bar')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('Selecionar Paciência')).toHaveProperty('checked', false);
  });

  it('pede confirmação listando os apps e envia as famílias ao confirmar', async () => {
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover selecionados' }));

    expect(state.remove).not.toHaveBeenCalled();
    expect(screen.getByText('Remover apps selecionados')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remover apps' }));

    await waitFor(() => expect(state.remove).toHaveBeenCalledWith([XBOX]));
    await waitFor(() => expect(state.toasts.at(-1)?.type).toBe('success'));
  });

  it('remove direto quando a confirmação está desligada', async () => {
    state.confirmOnExecute = false;
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover selecionados' }));

    await waitFor(() => expect(state.remove).toHaveBeenCalledWith([XBOX]));
    expect(screen.queryByText('Remover apps selecionados')).toBeNull();
  });

  it('avisa quando parte da remoção falha', async () => {
    state.remove.mockResolvedValue({
      removed: [XBOX],
      failed: [{ familyName: SOLITAIRE.familyName, error: 'pacote em uso' }],
    });
    state.confirmOnExecute = false;
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover selecionados' }));

    await waitFor(() => expect(state.toasts.at(-1)?.type).toBe('warning'));
    expect(state.toasts.at(-1)?.description).toContain('reinstalad');
  });

  it('mostra erro quando o main recusa a remoção', async () => {
    state.remove.mockRejectedValue(new Error('requer administrador'));
    state.confirmOnExecute = false;
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover selecionados' }));

    await waitFor(() => expect(state.toasts.at(-1)?.type).toBe('error'));
    expect(state.toasts.at(-1)?.description).toContain('administrador');
  });
});

describe('DebloatPage — sem administrador', () => {
  it('permite selecionar para consulta sem admin, mas mantém a remoção bloqueada', () => {
    state.inventory = inventory([app(), PROTECTED_STORE], false);
    render(<DebloatPage />);

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));

    expect(screen.getByLabelText('Selecionar Xbox Game Bar')).toHaveProperty('disabled', false);
    expect(screen.getByText('1 selecionado')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Remover selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('lista os apps, avisa e bloqueia a remoção até reiniciar como admin', () => {
    state.inventory = inventory([app(), PROTECTED_STORE], false);
    render(<DebloatPage />);

    expect(screen.getByText('Xbox Game Bar')).not.toBeNull();
    expect(screen.getByText(/precisa de administrador/i)).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Atualizar dados' }).className).not.toContain('pb-6');

    fireEvent.click(screen.getByLabelText('Selecionar Xbox Game Bar'));
    expect(
      (screen.getByRole('button', { name: 'Remover selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar como admin' }));
    expect(state.elevate).toHaveBeenCalledWith(undefined, undefined, undefined, true);
  });
});

describe('DebloatPage — virtualização', () => {
  it('renderiza só as linhas visíveis devolvidas pelo virtualizador', () => {
    // A ordem padrão do beforeEach é: Xbox(0), Store(1), Paciência(2), Fotos(3).
    state.virtual = { indices: [2], paddingTop: 138, paddingBottom: 69 };
    render(<DebloatPage />);

    expect(screen.getByText('Paciência')).not.toBeNull();
    expect(screen.queryByText('Xbox Game Bar')).toBeNull();
    expect(screen.queryByText('Microsoft Store')).toBeNull();
    expect(screen.queryByText('Fotos')).toBeNull();
  });

  it('mantém a altura total com espaçadores acima e abaixo das linhas visíveis', () => {
    state.virtual = { indices: [1, 2], paddingTop: 69, paddingBottom: 138 };
    const { container } = render(<DebloatPage />);

    const top = container.querySelector('[data-testid="virtual-spacer-top"]');
    const bottom = container.querySelector('[data-testid="virtual-spacer-bottom"]');
    expect((top as HTMLElement).style.height).toBe('69px');
    expect((bottom as HTMLElement).style.height).toBe('138px');
  });

  it('a lista virtualizada continua permitindo selecionar a linha visível', () => {
    state.virtual = { indices: [2], paddingTop: 138, paddingBottom: 69 };
    render(<DebloatPage />);

    fireEvent.click(screen.getByText('Paciência'));

    expect(screen.getByLabelText('Selecionar Paciência')).toHaveProperty('checked', true);
    expect(screen.getByText('1 selecionado')).not.toBeNull();
  });

  it('usa a rolagem da página, sem container de scroll próprio', () => {
    const { container } = render(<DebloatPage />);

    expect(state.virtualCalls[0]?.scrollRef).toBeNull();
    expect(state.virtualCalls[0]?.listRef).not.toBeNull();

    const list = container.querySelector('[data-testid="apps-list"]');
    expect(list).not.toBeNull();
    expect(list?.className).not.toContain('overflow-y-auto');
    expect(list?.className).not.toContain('max-h-');
  });

  it('expõe data-index na linha medida para o virtualizador não reclamar', () => {
    state.virtual = { indices: [2], paddingTop: 138, paddingBottom: 69 };
    render(<DebloatPage />);

    const row = screen.getByText('Paciência').closest('li');
    expect(row?.getAttribute('data-index')).toBe('2');
  });
});
