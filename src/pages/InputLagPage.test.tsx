// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Input Lag.
 *
 * Os selos contam o que a seção realmente renderiza, não o balde de
 * subcategoria do catálogo: `inputlag-9`/`inputlag-11` estão arquivados como
 * "Regedit" em scripts.json mas aparecem nos cards de teclado/mouse. O teste
 * também trava o card recolhido (scripts só aparecem depois de "Ver tweaks") e
 * a execução direta do card com um único script.
 */

const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  activeExecution: null as string | null,
  applied: new Set<string>(),
  handleCancel: vi.fn(),
  handleConfirmExecute: vi.fn(),
  page: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: (category: string) => {
    store.page(category);
    return {
      state: store.state,
      categoryScripts: store.scripts,
      activeExecution: store.activeExecution,
      handleExecute: () => {},
      handleCancel: store.handleCancel,
      handleConfirmExecute: store.handleConfirmExecute,
      confirmScript: null,
      setConfirmScript: () => {},
      handleConfirm: () => {},
    };
  },
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

// Path2D não existe no jsdom; o fundo não influencia a página.
vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

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

const FULL_CATALOG = [
  script('inputlag-1', 'Latência de digitação'),
  script('inputlag-9', 'Resposta de teclas'),
  script('inputlag-2', 'Mouse sem aceleração'),
  script('inputlag-11', 'Movimento preciso'),
  script('inputlag-3', 'Latência do driver de vídeo'),
  script('inputlag-4', 'Aplicar Todas Otimizações'),
  script('inputlag-5', 'Reduzir Input Lag USB'),
  script('inputlag-6', 'TCPNoDelay'),
  script('inputlag-7', 'Prioridade de Foreground'),
  script('inputlag-8', 'Desativar LargeSystemCache'),
  script('inputlag-10', 'Atraso no Menu'),
];

function bodyText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = FULL_CATALOG;
  store.activeExecution = null;
  store.applied = new Set();
  store.handleCancel.mockClear();
  store.handleConfirmExecute.mockClear();
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

describe('InputLagPage — hero e dispositivos', () => {
  it('pede ao hook a categoria Input Lag', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(store.page).toHaveBeenCalledWith('Input Lag'));
  });

  it('apresenta o hero e os três cards de dispositivo', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Teclado'));
    const text = bodyText();

    expect(text).toContain('Reduza o Input Lag do seu PC');
    expect(text).toContain('Teclado');
    expect(text).toContain('Mouse');
    expect(text).toContain('Monitor');
    // "O que otimiza" aparece uma vez em cada um dos três cards.
    expect(count(text, 'O que otimiza:')).toBe(3);
    expect(text).toContain('KeyboardDelay reduzido a zero');
  });
});

describe('InputLagPage — contagem dos selos', () => {
  it('conta só os scripts curados que os cards mostram', async () => {
    // Um script extra no balde da categoria não pode inflar o selo de dispositivos.
    store.scripts = [...FULL_CATALOG, script('inputlag-99', 'Sobrando do catálogo')];

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Dispositivos'));
    const text = bodyText();

    expect(count(text, '5 tweaks')).toBe(1); // 2 teclado + 2 mouse + 1 monitor
    expect(count(text, '6 tweaks')).toBe(1); // registros curados
    expect(text).not.toContain('12 tweaks');
    expect(text).not.toContain('Sobrando do catálogo');
  });

  it('encolhe os selos quando o catálogo não traz todos os ids', async () => {
    store.scripts = [
      script('inputlag-1', 'Latência de digitação'),
      script('inputlag-2', 'Mouse sem aceleração'),
      script('inputlag-3', 'Latência do driver de vídeo'),
      script('inputlag-4', 'Aplicar Todas Otimizações'),
    ];

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Dispositivos'));
    const text = bodyText();

    expect(count(text, '3 tweaks')).toBe(1); // um script em cada card de dispositivo
    expect(count(text, '1 tweaks')).toBe(4); // 3 cards + 1 registro
    expect(text).toContain('Aplicar Todas Otimizações');
    expect(text).not.toContain('Reduzir Input Lag USB');
  });
});

describe('InputLagPage — cards recolhidos', () => {
  it('só renderiza os scripts do card depois de "Ver tweaks"', async () => {
    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Teclado'));
    expect(bodyText()).not.toContain('Latência de digitação');

    const [first] = screen.getAllByRole('button', { name: /Ver tweaks/ });
    fireEvent.click(first);

    expect(bodyText()).toContain('Latência de digitação');
    expect(bodyText()).toContain('Resposta de teclas');
    expect(screen.getAllByRole('button', { name: /Ocultar tweaks/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Ver tweaks/ })).toHaveLength(1);
  });

  it('executa direto o card que tem um único script', async () => {
    const monitor = script('inputlag-3', 'Latência do driver de vídeo');
    // Só os scripts dos dispositivos: teclado e mouse têm dois (mostram
    // "Ver tweaks"); o monitor tem um só e executa no clique.
    store.scripts = FULL_CATALOG.filter((s) =>
      ['inputlag-1', 'inputlag-9', 'inputlag-2', 'inputlag-11', 'inputlag-3'].includes(s.id)
    );

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Dispositivos'));
    expect(screen.getAllByRole('button', { name: /Ver tweaks/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    expect(store.handleConfirmExecute).toHaveBeenCalledWith(monitor);
  });
});

describe('InputLagPage — registros', () => {
  it('troca "Executar" por "Executar novamente" no registro já aplicado', async () => {
    store.applied = new Set(['inputlag-4']);

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Executar novamente'));
    expect(count(bodyText(), 'Executar novamente')).toBe(1);
  });

  it('cancela o registro em execução pelo id do script', async () => {
    store.activeExecution = 'inputlag-4';

    render(<InputLagPage />);

    const cancel = await screen.findByRole('button', { name: /Cancelar/ });
    fireEvent.click(cancel);

    expect(store.handleCancel).toHaveBeenCalledWith('inputlag-4');
  });

  it('não renderiza item de registro cujo script saiu do catálogo', async () => {
    store.scripts = FULL_CATALOG.filter((s) => s.id !== 'inputlag-8');

    render(<InputLagPage />);

    await waitFor(() => expect(bodyText()).toContain('Otimizações do Registro'));
    const text = bodyText();

    expect(text).not.toContain('Desativar LargeSystemCache');
    // Dispositivos continuam com 5; o selo dos registros caiu de 6 para 5.
    expect(count(text, '5 tweaks')).toBe(2);
  });
});
