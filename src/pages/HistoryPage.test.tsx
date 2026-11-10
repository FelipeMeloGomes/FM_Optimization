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

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import HistoryPage from './HistoryPage';

const store = vi.hoisted<{ state: AsyncState<ExecutionHistoryEntry[]> }>(() => ({
  state: { status: 'success', data: [] },
}));

function entry(overrides: Partial<ExecutionHistoryEntry> = {}): ExecutionHistoryEntry {
  return {
    id: 'h-1',
    scriptId: 'cpu-10',
    scriptName: 'cpu-10',
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

  it('renderiza herói, contador e estatísticas', () => {
    store.state = {
      status: 'success',
      data: [entry(), entry({ exitCode: 1 }), entry({ wasCancelled: true })],
    };

    const html = render();

    expect(html).toContain('Histórico de Execuções');
    expect(html).toContain('3 execuções');
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

    expect(html).toContain('cpu-10');
    expect(html).toContain('Automática');
    expect(html).toContain('1s');
    expect(html).toContain('Sucesso');
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
});
