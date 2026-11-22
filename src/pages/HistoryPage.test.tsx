// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ExecutionHistoryEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Histórico: estados de carregamento/erro/vazio, herói,
 * estatísticas (total/sucesso/erros/cancelados) e tabela de registros com
 * origem, data, duração e status. `useHistoryContext` é mockado na fronteira.
 */

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: store.state }),
}));

const virtual = vi.hoisted(() => ({
  calls: [] as { scrollRef: unknown; listRef: unknown }[],
}));

vi.mock('../hooks/use-virtual-rows', () => ({
  useVirtualRows: <T,>(items: T[], scrollRef: unknown, _rowHeight?: unknown, listRef?: unknown) => {
    virtual.calls.push({ scrollRef, listRef });
    return {
      virtualItems: items.map((_, index) => ({
        index,
        key: index,
        start: index * 57,
        end: (index + 1) * 57,
        size: 57,
        lane: 0,
      })),
      paddingTop: 0,
      paddingBottom: 0,
      measureElement: () => {},
    };
  },
}));

import HistoryPage from './HistoryPage';

const store = vi.hoisted<{ state: AsyncState<ExecutionHistoryEntry[]> }>(() => ({
  state: { status: 'success', data: [] },
}));

function entry(overrides: Partial<ExecutionHistoryEntry> = {}): ExecutionHistoryEntry {
  return {
    id: 'h-1',
    scriptId: 'cpu-16',
    scriptName: 'cpu-16',
    startTime: '2026-01-05T10:00:00.000Z',
    endTime: '2026-01-05T10:00:01.500Z',
    durationMs: 1500,
    exitCode: 0,
    wasCancelled: false,
    ...overrides,
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
  return text(renderToStaticMarkup(<HistoryPage />));
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  virtual.calls.length = 0;
});

describe('HistoryPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.state = { status: 'loading' };

    const html = renderToStaticMarkup(<HistoryPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Histórico de Execuções');
  });

  it('mostra o erro quando a leitura falha', () => {
    store.state = { status: 'error', error: 'banco bloqueado' };

    const html = text(render());

    expect(html).toContain('Erro ao carregar histórico');
    expect(html).toContain('banco bloqueado');
  });

  it('mostra estado vazio quando não há registros', () => {
    const html = render();

    expect(html).toContain('Nenhuma execução registrada');
    expect(html).toContain('Execute um script para vê-lo aqui');
  });

  it('renderiza herói e estatísticas sem badge de contagem', () => {
    store.state = {
      status: 'success',
      data: [entry(), entry({ exitCode: 1 }), entry({ wasCancelled: true })],
    };

    const html = render();

    expect(html).toContain('Histórico de Execuções');
    expect(html).not.toContain('3 execuções');
    expect(html).toContain('Total');
    expect(html).toContain('3');
    expect(html).toContain('Sucesso');
    expect(html).toContain('1');
    expect(html).toContain('Erros');
    expect(html).toContain('1');
    expect(html).toContain('Cancelados');
    expect(html).toContain('1');
  });

  it('lista registros com script, origem, data, duração e status', () => {
    store.state = {
      status: 'success',
      data: [entry({ trigger: 'scheduled', exitCode: 0 })],
    };

    const html = render();

    expect(html).toContain('cpu-16');
    expect(html).toContain('Automática');
    expect(html).toContain('1s');
    expect(html).toContain('Sucesso');
  });

  it('rotula a coluna do nome como Tweak', () => {
    store.state = { status: 'success', data: [entry()] };

    const html = renderToStaticMarkup(<HistoryPage />);

    expect(html).toContain('>Tweak<');
    expect(html).not.toContain('>Script<');
  });

  it('mostra duração "—" para cancelados e sem código', () => {
    store.state = {
      status: 'success',
      data: [entry({ wasCancelled: true, exitCode: null }), entry({ exitCode: null })],
    };

    const html = render();

    expect(html).toContain('—');
  });

  it('mostra origem manual por padrão', () => {
    store.state = { status: 'success', data: [entry()] };

    const html = render();

    expect(html).toContain('Manual');
    expect(html).not.toContain('Automática');
  });

  it('mostra "Interrompido pelo usuário" quando o usuário fecha a janela do script', () => {
    store.state = { status: 'success', data: [entry({ exitCode: -2 })] };

    const html = render();

    expect(html).toContain('Interrompido pelo usuário');
    // O painel de estatísticas sempre escreve "Sucesso"; uma segunda ocorrência
    // seria o selo de sucesso indevido na linha.
    expect(html.match(/Sucesso/g)).toHaveLength(1);
  });

  it('não rotula a interrupção do usuário como erro de spawn', () => {
    store.state = { status: 'success', data: [entry({ exitCode: -2 })] };

    const html = render();

    expect(html).not.toContain('Erro (spawn)');
  });

  it('não conta a interrupção do usuário como erro nas estatísticas', () => {
    store.state = { status: 'success', data: [entry({ exitCode: -2 })] };

    const html = render();

    expect(html).toContain('Total 1');
    expect(html).toContain('Erros 0');
  });

  it('continua rotulando falhas reais como erro', () => {
    store.state = {
      status: 'success',
      data: [entry({ exitCode: 1 }), entry({ exitCode: -1, id: 'h-2' })],
    };

    const html = render();

    expect(html).toContain('Erro (1)');
    expect(html).toContain('Erro (spawn)');
    expect(html).toContain('Erros 2');
  });

  it('usa a rolagem da página em vez de um container de scroll próprio', () => {
    store.state = { status: 'success', data: [entry()] };

    const html = renderToStaticMarkup(<HistoryPage />);

    expect(virtual.calls).toHaveLength(1);
    expect(virtual.calls[0].scrollRef).toBeNull();
    expect(virtual.calls[0].listRef).not.toBeNull();
    expect(html).not.toContain('max-h-[');
    expect(html).not.toContain('overflow-auto');
    expect(html).toContain('overflow-visible');
    // O card não pode criar scrollport, senão o cabeçalho sticky cola nele
    // em vez de acompanhar a rolagem da página.
    expect(html).not.toContain('border-border overflow-hidden');
  });
});
