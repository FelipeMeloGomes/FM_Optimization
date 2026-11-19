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

    expect(html).toContain('cpu-16');
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
});
