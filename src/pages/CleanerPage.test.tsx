// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Limpeza: estados de carregamento/erro, herói, cards de
 * limpeza (4 cards com nome/descrição/frequência), estatísticas totais e seção
 * de limpezas pendentes. `useScriptPage`, `useCleanerStats`, `useSettingsContext`,
 * `useIsScriptApplied` e `useAutoCleanContext` são mockados na fronteira.
 */

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleCancel: () => {},
    handleConfirmExecute: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-cleaner-stats', () => ({
  useCleanerStats: () => store.stats,
  formatBytes: vi.fn((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { soundEnabled: false } }),
}));

vi.mock('../contexts/AutoCleanContext', () => ({
  useAutoCleanContext: () => store.autoClean,
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import CleanerPage from './CleanerPage';

let store: {
  page: AsyncState<{ scripts: ScriptEntry[] }>;
  scripts: ScriptEntry[];
  stats: {
    stats: Record<string, { fileCount: number; totalSizeBytes: number }>;
    loading: boolean;
    isRefreshing: boolean;
    lastRefreshed: number;
    refresh: ReturnType<typeof vi.fn>;
    previousStats: {
      current: Record<string, { fileCount: number; totalSizeBytes: number }>;
    };
  };
  autoClean: {
    status: {
      settings: { pending: string[] };
      running: boolean;
      isAdmin: boolean;
    };
    runPending: ReturnType<typeof vi.fn>;
    discard: ReturnType<typeof vi.fn>;
    relaunchAsAdmin: ReturnType<typeof vi.fn>;
  };
};

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category: 'Cleaner',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [] as string[],
  };
}

function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(): string {
  return text(renderToStaticMarkup(<CleanerPage />));
}

beforeEach(() => {
  store = {
    page: { status: 'success', data: { scripts: [] } },
    scripts: [],
    stats: {
      stats: {},
      loading: false,
      isRefreshing: false,
      lastRefreshed: 0,
      refresh: vi.fn(),
      previousStats: { current: {} },
    },
    autoClean: {
      status: { settings: { pending: [] }, running: false, isAdmin: false },
      runPending: vi.fn(),
      discard: vi.fn(),
      relaunchAsAdmin: vi.fn(),
    },
  };
});

describe('CleanerPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const html = renderToStaticMarkup(<CleanerPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Mantenha seu Windows limpo e rápido');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'scripts ilegíveis' };

    const html = text(render());

    expect(html).toContain('Erro ao carregar scripts de limpeza');
    expect(html).toContain('scripts ilegíveis');
  });

  it('renderiza o herói e os quatro cards de limpeza', () => {
    store.scripts = [script('cleaner-1', 'Limpeza Rápida')];

    const html = render();

    expect(html).toContain('Mantenha seu Windows limpo e rápido');
    expect(html).toContain('Remova arquivos temporários');
    expect(html).toContain('Limpeza Rápida');
    expect(html).toContain('Limpeza de Atualizações');
    expect(html).toContain('Limpeza de Navegadores');
    expect(html).toContain('Limpeza Total');
    expect(html).not.toContain('animate-pulse');
  });

  it('mostra estatísticas totais quando há dados atualizados', () => {
    store.stats = {
      stats: {
        'cleaner-1': { fileCount: 1200, totalSizeBytes: 2_147_483_648 },
      },
      loading: false,
      isRefreshing: false,
      lastRefreshed: Date.now() - 60_000,
      refresh: vi.fn(),
      previousStats: { current: {} },
    };

    const html = render();

    expect(html).toContain('Atualizado há 1 min');
    expect(html).toContain('1.200 arquivos');
    expect(html).toContain('2 GB totais para limpar');
  });

  it('mostra a seção de limpezas pendentes quando houver', () => {
    store.autoClean = {
      status: { settings: { pending: ['cleaner-1'] }, running: false, isAdmin: false },
      runPending: vi.fn(),
      discard: vi.fn(),
      relaunchAsAdmin: vi.fn(),
    };

    const html = render();

    expect(html).toContain('1 limpeza(s) automática(s) aguardando administrador');
    expect(html).toContain('Limpeza Rápida');
    expect(html).toContain('Executar agora');
  });

  it('mostra botão de reiniciar como admin quando não é admin e há pendências', () => {
    store.autoClean = {
      status: { settings: { pending: ['cleaner-1'] }, running: false, isAdmin: false },
      runPending: vi.fn(),
      discard: vi.fn(),
      relaunchAsAdmin: vi.fn(),
    };

    const html = render();

    expect(html).toContain('Reiniciar como admin');
  });
});
