// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Depois que os tweaks de dispositivo foram para as páginas de Mouse, Monitor
 * e Teclado na seção Sistema, Input Lag mostra apenas os seis ajustes de registro.
 * Os testes travam que nenhum card de teclado/mouse/monitor volta a aparecer
 * aqui, mesmo se um script de dispositivo vazar no `categoryScripts`.
 *
 * A página agora usa seleção múltipla: checkbox por card, barra de seleção com
 * contador e um único botão "Aplicar selecionados" que repassa a `selectedScripts`
 * do `useScriptSelection` ao `handleApply` do `use-script-page`. O mock do hook
 * de página expõe a API de lote; o hook de seleção é o real (não mockado).
 */

const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  activeExecution: null as string | null,
  applied: new Set<string>(),
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
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

import InputLagPage from './InputLagPage';

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `Descrição de ${name}`,
    category: 'Input Lag',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const NAMES: Record<string, string> = {
  'inputlag-5': 'Reduzir Input Lag USB',
  'inputlag-6': 'TCPNoDelay',
  'inputlag-7': 'Prioridade de Foreground',
  'inputlag-8': 'Desativar LargeSystemCache',
  'inputlag-10': 'Atraso no Menu',
};
const REGISTRY_IDS = Object.keys(NAMES);
const FULL_CATALOG = REGISTRY_IDS.map((id) => script(id, NAMES[id]));

function bodyText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = FULL_CATALOG;
  store.activeExecution = null;
  store.applied = new Set();
  store.handleCancel.mockClear();
  store.handleApply.mockClear();
  store.page.mockClear();
});

describe('InputLagPage — estados', () => {
  it('mostra o esqueleto enquanto o catálogo carrega', () => {
    store.state = { status: 'loading' };

    const { container } = render(<InputLagPage />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(bodyText()).not.toContain('Reduza o Input Lag do seu PC');
  });

  it('mostra o erro devolvido pelo catálogo', async () => {
    store.state = { status: 'error', error: 'falha ao ler scripts.json' };

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Erro ao carregar tweaks'));
    expect(bodyText()).toContain('falha ao ler scripts.json');
  });
});

describe('InputLagPage — hero e registros', () => {
  it('pede ao hook a categoria Input Lag', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(store.page).toHaveBeenCalledWith('Input Lag'));
  });

  it('mostra o hero sem o título e o contador de registros', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const text = bodyText();

    expect(text).toContain('Reduza o Input Lag do seu PC');
    expect(text).not.toContain('Otimizações do Registro');
    expect(text).not.toMatch(/\d+\s+tweaks/);
    // Os cards de dispositivo agora vivem em /perifericos.
    expect(text).not.toContain('Dispositivos');
    expect(text).not.toContain('O que otimiza:');
    expect(text).not.toContain('Teclado');
    expect(text).not.toContain('Mouse');
    expect(text).not.toContain('Monitor');
  });

  it('não mostra tweaks de dispositivo que vazem no categoryScripts', async () => {
    store.scripts = [...FULL_CATALOG, script('inputlag-1', 'Latência de digitação')];

    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const text = bodyText();

    expect(text).not.toContain('Dispositivos');
    expect(text).not.toContain('Latência de digitação');
    expect(text).not.toContain('Otimizações do Registro');
    expect(text).not.toMatch(/\d+\s+tweaks/);
  });
});

describe('InputLagPage — sem cabeçalho de registros', () => {
  it('não mostra o título nem o contador mesmo com scripts extras no catálogo', async () => {
    store.scripts = [...FULL_CATALOG, script('inputlag-99', 'Sobrando do catálogo')];

    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const text = bodyText();

    expect(text).not.toContain('Otimizações do Registro');
    expect(text).not.toMatch(/\d+\s+tweaks/);
    expect(text).not.toContain('Sobrando do catálogo');
  });

  it('mantém a lista curada quando falta um script do registry', async () => {
    store.scripts = FULL_CATALOG.filter((s) => s.id !== 'inputlag-5');

    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    expect(screen.getByTestId('tweaks-list').querySelectorAll('li[data-index]')).toHaveLength(4);
    expect(screen.queryByText('Reduzir Input Lag USB')).toBeNull();
    expect(screen.getByText('TCPNoDelay')).toBeDefined();
    expect(bodyText()).not.toMatch(/\d+\s+tweaks/);
  });
});

describe('InputLagPage — lista única no padrão da Limpeza', () => {
  it('usa uma lista com divide-y, nomes curados e sem o pacote inputlag-4', async () => {
    store.scripts = [...FULL_CATALOG, script('inputlag-4', 'Pacote Amplo de Input')];

    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const list = screen.getByTestId('tweaks-list');
    expect(list.querySelector('ul')?.className).toContain('divide-y');
    expect(list.querySelectorAll('li[data-index]')).toHaveLength(5);
    expect(screen.getByText('Reduzir Input Lag USB').closest('label')).not.toBeNull();
    expect(screen.queryByText('Pacote Amplo de Input')).toBeNull();
  });

  it('mantém espaço entre a barra de seleção e a lista', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const list = screen.getByTestId('tweaks-list');
    const selectAll = screen.getByRole('checkbox', { name: /Selecionar todos/ });

    expect(list.parentElement?.className).toContain('space-y-4');
    expect(list.parentElement?.contains(selectAll)).toBe(true);
  });

  it('atualiza o contador da barra ao marcar um tweak da lista', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar TCPNoDelay' }));

    expect(screen.getByText('1 de 5 selecionados')).toBeDefined();
  });
});

describe('InputLagPage — registros', () => {
  it('não mostra "Aplicar Todas Otimizações", o card do pacote amplo nem o contador', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    expect(bodyText()).not.toContain('Aplicar Todas Otimizações');
    expect(bodyText()).not.toMatch(/\d+\s+tweaks/);
  });

  it('seleciona um tweak e aplica só ele pelo botão de lote', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());

    const check = screen.getByRole('checkbox', { name: 'Selecionar TCPNoDelay' });
    expect((check as HTMLInputElement).checked).toBe(false);
    fireEvent.click(check);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual([
      'inputlag-6',
    ]);
  });

  it('cancela o registro em execução pelo id do script', async () => {
    store.activeExecution = 'inputlag-6';

    render(<InputLagPage />);

    const cancel = await screen.findByRole('button', { name: /Cancelar/ });
    fireEvent.click(cancel);

    expect(store.handleCancel).toHaveBeenCalledWith('inputlag-6');
  });

  it('não renderiza item de registro cujo script saiu do catálogo', async () => {
    store.scripts = FULL_CATALOG.filter((s) => s.id !== 'inputlag-8');

    render(<InputLagPage />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    expect(screen.queryByText('Desativar LargeSystemCache')).toBeNull();
    expect(screen.getByTestId('tweaks-list').querySelectorAll('li[data-index]')).toHaveLength(4);
    expect(bodyText()).not.toMatch(/\d+\s+tweaks/);
  });
});
