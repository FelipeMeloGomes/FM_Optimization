// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PAGE_SKELETON_LAYOUTS,
  PageSkeleton,
  type PageSkeletonLayout,
  type PageSkeletonProps,
} from './PageSkeleton';

function countOf(container: HTMLElement, part: string): number {
  return container.querySelectorAll(`[data-skeleton="${part}"]`).length;
}

function renderSkeleton(layout: PageSkeletonLayout, props: Partial<PageSkeletonProps> = {}) {
  return render(<PageSkeleton layout={layout} {...props} />);
}

describe('PageSkeleton — acessibilidade', () => {
  it('anuncia o carregamento para leitores de tela', () => {
    renderSkeleton('tweaks', { label: 'Carregando ajustes…' });

    const status = screen.getByRole('status', { name: 'Carregando ajustes…' });
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('tem uma receita para cada layout usado pelas páginas', () => {
    expect(PAGE_SKELETON_LAYOUTS).toEqual([
      'tweaks',
      'list',
      'dashboard',
      'meu-pc',
      'history',
      'restore',
      'startup',
      'device',
      'cards',
      'comparison',
      'analysis',
      'settings',
      'overlay',
      'minimal',
      'dns',
      'emulators',
      'settings-page',
    ]);
  });
});

describe('PageSkeleton — listas de tweaks', () => {
  it('mostra uma linha por tweak, igual à lista virtualizada', () => {
    const { container } = renderSkeleton('tweaks', { count: 5, label: 'Carregando ajustes…' });

    expect(countOf(container, 'row')).toBe(5);
    expect(countOf(container, 'hero')).toBe(1);
    expect(countOf(container, 'toolbar')).toBe(1);
    expect(countOf(container, 'card')).toBe(0);
  });

  it('inclui a barra de atualização nas páginas de catálogo', () => {
    const { container } = renderSkeleton('list');

    expect(countOf(container, 'row')).toBe(6);
    expect(countOf(container, 'refresh')).toBe(1);
  });

  it('usa a quantidade pedida mesmo quando é zero', () => {
    const { container } = renderSkeleton('tweaks', { count: 0 });

    expect(countOf(container, 'row')).toBe(0);
  });
});

describe('PageSkeleton — painéis', () => {
  it('repete os dois grupos de três widgets do Dashboard e o rodapé', () => {
    const { container } = renderSkeleton('dashboard');

    expect(countOf(container, 'section')).toBe(2);
    expect(countOf(container, 'card')).toBe(6);
    expect(countOf(container, 'footer')).toBe(1);
    expect(countOf(container, 'refresh')).toBe(1);
  });

  it('mostra os três grupos do Meu PC, com sete itens no último', () => {
    const { container } = renderSkeleton('meu-pc');

    const grids = container.querySelectorAll('[data-skeleton="grid"]');
    expect(grids).toHaveLength(3);
    expect(grids[2].children.length).toBe(7);
  });

  it('mostra quatro indicadores e uma tabela de cinco colunas no histórico', () => {
    const { container } = renderSkeleton('history');

    expect(countOf(container, 'stat')).toBe(4);
    expect(countOf(container, 'column')).toBe(5);
    expect(countOf(container, 'row')).toBe(6);
  });

  it('mostra o formulário de criação antes da tabela de pontos', () => {
    const { container } = renderSkeleton('restore');

    expect(countOf(container, 'form')).toBe(1);
    expect(countOf(container, 'column')).toBe(4);
  });

  it('mostra três estatísticas no hero e três tabelas na Initial/Startup', () => {
    const { container } = renderSkeleton('startup');

    expect(countOf(container, 'hero-stat')).toBe(3);
    expect(countOf(container, 'tab')).toBe(3);
    expect(countOf(container, 'table')).toBe(3);
  });
});

describe('PageSkeleton — cartões e formulários', () => {
  it('empilha os cartões quando a página não usa grade', () => {
    const { container } = renderSkeleton('cards', { count: 4, columns: 1 });

    expect(countOf(container, 'card')).toBe(4);
    expect(container.querySelector('[data-skeleton="grid"]')).toBeNull();
  });

  it('usa o hero com foto e um único cartão na página de dispositivo', () => {
    const { container } = renderSkeleton('device');

    expect(countOf(container, 'hero-photo')).toBe(1);
    expect(countOf(container, 'card')).toBe(1);
    expect(countOf(container, 'settings')).toBe(1);
  });

  it('omite o hero quando a página já mostra um banner próprio no carregamento', () => {
    const { container } = renderSkeleton('comparison');

    expect(countOf(container, 'hero')).toBe(0);
    expect(countOf(container, 'picker')).toBe(2);
    expect(countOf(container, 'versus')).toBe(1);
    expect(countOf(container, 'column')).toBeGreaterThan(0);
  });

  it('mostra a nota e a grade de áreas na análise do PC', () => {
    const { container } = renderSkeleton('analysis', { count: 4 });

    expect(countOf(container, 'score')).toBe(1);
    expect(countOf(container, 'area')).toBe(4);
  });

  it('mostra preview e controles lado a lado nos painéis de ajuste', () => {
    const { container } = renderSkeleton('settings');

    expect(countOf(container, 'preview')).toBe(1);
    expect(countOf(container, 'controls')).toBe(1);
    expect(countOf(container, 'action')).toBe(4);
  });

  it('mostra cartões de jogo empilhados enquanto a lista carrega', () => {
    const { container } = renderSkeleton('overlay', { count: 3 });

    expect(countOf(container, 'card')).toBe(3);
    expect(container.querySelector('[data-skeleton="grid"]')).toBeNull();
  });

  it('permite esconder o hero em qualquer layout', () => {
    const { container } = renderSkeleton('dashboard', { hero: 'none' });

    expect(countOf(container, 'hero')).toBe(0);
  });
});

describe('PageSkeleton — últimas páginas', () => {
  it('mostra o cartão de status e uma linha por provedor de DNS', () => {
    const { container } = renderSkeleton('dns', {
      count: 7,
      hero: 'none',
      label: 'Carregando informações de rede…',
    });

    expect(screen.getByRole('status', { name: 'Carregando informações de rede…' })).toBeDefined();
    expect(countOf(container, 'dns-status')).toBe(1);
    expect(countOf(container, 'dns-provider')).toBe(7);
    expect(countOf(container, 'hero')).toBe(0);
  });

  it('mostra o cartão do ADB e um card por emulador', () => {
    const { container } = renderSkeleton('emulators', { count: 2, hero: 'none' });

    expect(countOf(container, 'adb-status')).toBe(1);
    expect(countOf(container, 'grid')).toBe(1);
    expect(countOf(container, 'card')).toBe(2);
    expect(countOf(container, 'hero')).toBe(0);
  });

  it('mostra os seis blocos de configurações sem hero', () => {
    const { container } = renderSkeleton('settings-page', { hero: 'none' });

    expect(countOf(container, 'settings-section')).toBe(6);
    expect(countOf(container, 'hero')).toBe(0);
  });
});
