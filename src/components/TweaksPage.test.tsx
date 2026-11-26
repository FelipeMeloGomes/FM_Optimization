// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/** O layout é testado com o componente real; só a fronteira de hooks é mockada. */
const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  activeExecution: null as string | null,
  handleCancel: vi.fn(),
  handleApply: vi.fn(),
  reloadScripts: vi.fn(),
  page: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: (category: string | string[]) => {
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
      reloadScripts: store.reloadScripts,
    };
  },
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

import { TweaksPage, type TweaksPageHero } from './TweaksPage';

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `Descrição de ${name}`,
    category: 'Teste',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const HERO: TweaksPageHero = {
  path: '/cpu',
  badge: ' Desempenho '.trim(),
  title: 'Página de teste',
  description: 'Descrição da página de teste',
  image: '/cpu.svg',
  imageAlt: 'Ilustração de processador em soquete com dissipador',
};

const CATALOG = [script('a', 'Alpha'), script('b', 'Beta'), script('c', 'Gamma')];

function bodyText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = CATALOG;
  store.activeExecution = null;
  store.handleCancel.mockClear();
  store.handleApply.mockClear();
  store.reloadScripts.mockClear();
  store.page.mockClear();
});

function baseProps() {
  return { category: 'Teste', hero: HERO, skeletonCount: 3 };
}

describe('TweaksPage — estados', () => {
  it('mostra uma linha por tweak no esqueleto, igual à lista carregada', () => {
    store.state = { status: 'loading' };

    const { container } = render(<TweaksPage {...baseProps()} skeletonCount={2} />);

    expect(container.querySelectorAll('[data-skeleton="row"]')).toHaveLength(2);
    expect(container.querySelector('[data-skeleton="hero"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton="toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton="card"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="tweaks-list"]').length).toBe(0);
  });

  it('usa quatro linhas quando a página não informa a quantidade', () => {
    store.state = { status: 'loading' };

    const { container } = render(<TweaksPage category="Teste" hero={HERO} />);

    expect(container.querySelectorAll('[data-skeleton="row"]')).toHaveLength(4);
  });

  it('usa no selo o ícone da rota do hero', () => {
    const { container } = render(<TweaksPage {...baseProps()} />);

    expect(container.querySelector('svg')?.className.baseVal).toContain('lucide-gauge');
  });

  it('respeita extraLoading mesmo com o catálogo pronto', () => {
    render(<TweaksPage {...baseProps()} extraLoading />);

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('Página de teste')).toBeNull();
  });

  it('mostra o erro devolvido pelo catálogo', () => {
    store.state = { status: 'error', error: 'catálogo indisponível' };

    render(<TweaksPage {...baseProps()} />);

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar tweaks');
    expect(bodyText()).toContain('catálogo indisponível');
  });

  it('oferece Tentar novamente no erro e recarrega o catálogo', () => {
    store.state = { status: 'error', error: 'catálogo indisponível' };

    render(<TweaksPage {...baseProps()} />);

    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    expect(retry.className).toContain('border-input');
    fireEvent.click(retry);
    expect(store.reloadScripts).toHaveBeenCalledTimes(1);
  });

  it('usa heroContent no lugar do HeroBanner e o coloca antes do beforeContent', () => {
    render(
      <TweaksPage
        {...baseProps()}
        heroContent={<p>Hero personalizado</p>}
        beforeContent={<p>Painel de ajustes</p>}
      />
    );

    const hero = screen.getByText('Hero personalizado');
    const painel = screen.getByText('Painel de ajustes');
    expect(hero.compareDocumentPosition(painel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Página de teste')).toBeNull();
    expect(
      screen.queryByRole('img', {
        name: 'Ilustração de processador em soquete com dissipador',
      })
    ).toBeNull();
  });

  it('renderiza beforeContent mesmo durante loading e erro', () => {
    store.state = { status: 'loading' };
    const { rerender } = render(
      <TweaksPage {...baseProps()} beforeContent={<p>Painel sempre visível</p>} />
    );
    expect(screen.getByText('Painel sempre visível')).toBeDefined();

    store.state = { status: 'error', error: 'x' };
    rerender(<TweaksPage {...baseProps()} beforeContent={<p>Painel sempre visível</p>} />);
    expect(screen.getByText('Painel sempre visível')).toBeDefined();
  });
});

describe('TweaksPage — layout e seleção', () => {
  it('passa a categoria ao hook e renderiza o hero', async () => {
    render(<TweaksPage {...baseProps()} category={['Internet', 'DNS Manager']} />);

    await waitFor(() => expect(store.page).toHaveBeenCalledWith(['Internet', 'DNS Manager']));
    expect(screen.getByText('Página de teste')).toBeDefined();
    expect(screen.getByText('Desempenho')).toBeDefined();
    expect(screen.getByText('Descrição da página de teste')).toBeDefined();
    expect(
      screen.getByRole('img', { name: 'Ilustração de processador em soquete com dissipador' })
    ).toBeDefined();
  });

  it('renderiza a lista virtualizada com uma linha por tweak', async () => {
    render(<TweaksPage {...baseProps()} />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    const list = screen.getByTestId('tweaks-list');

    expect(list.querySelector('ul')?.className).toContain('divide-y');
    expect(list.querySelectorAll('li[data-index]').length).toBe(3);
  });

  it('aplica transform antes da lista e da seleção', async () => {
    render(
      <TweaksPage {...baseProps()} transform={(scripts) => scripts.filter((s) => s.id !== 'a')} />
    );

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    expect(bodyText()).toContain('0 de 2 selecionados');
    expect(screen.queryByRole('checkbox', { name: /Selecionar Alpha/ })).toBeNull();
  });

  it('usa os rótulos curados quando fornecidos', async () => {
    render(
      <TweaksPage
        {...baseProps()}
        buildLabels={() => ({ a: { name: 'Nome curado', description: 'Desc curada' } })}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Selecionar Nome curado/ })).toBeDefined()
    );
    expect(screen.queryByRole('checkbox', { name: /Selecionar Alpha/ })).toBeNull();
  });

  it('entrega os scripts visíveis ao slot beforeList', async () => {
    const beforeList = vi.fn(() => <p data-testid="extra" />);

    render(<TweaksPage {...baseProps()} beforeList={beforeList} />);

    await waitFor(() => expect(screen.getByTestId('extra')).toBeDefined());
    expect(beforeList).toHaveBeenCalledWith(CATALOG);
  });

  it('seleciona e aplica apenas os tweaks marcados', async () => {
    render(<TweaksPage {...baseProps()} />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Selecionar Beta/ })).toBeDefined()
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar Beta/ }));
    expect(bodyText()).toContain('1 de 3 selecionados');

    fireEvent.click(screen.getByRole('button', { name: /Aplicar selecionados/ }));
    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect((store.handleApply.mock.calls[0][0] as ScriptEntry[]).map((s) => s.id)).toEqual(['b']);
  });

  it('mantém o espaçamento compacto entre barra e lista quando pedido', async () => {
    const { container } = render(<TweaksPage {...baseProps()} compactToolbarGap />);

    await waitFor(() => expect(screen.getByTestId('tweaks-list')).toBeDefined());
    expect(container.querySelector('.space-y-4')).not.toBeNull();
  });
});
