// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ExecutionHistoryEntry } from '../../electron/shared/ipc-types';

/**
 * O selo "Aplicado" é a interseção de duas regras: o script precisa ser contável
 * (`isCountableScript`) e ter pelo menos uma execução bem-sucedida no histórico.
 * O teste fixa as duas pontas com o histórico mockado na fronteira.
 */

const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ExecutionHistoryEntry[]>,
}));

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: store.state, refresh: () => {} }),
}));

import { useIsScriptApplied } from './use-is-script-applied';

function entry(
  scriptId: string,
  overrides: Partial<ExecutionHistoryEntry> = {}
): ExecutionHistoryEntry {
  return {
    id: `history-${scriptId}`,
    scriptId,
    scriptName: scriptId,
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    exitCode: 0,
    wasCancelled: false,
    ...overrides,
  };
}

beforeEach(() => {
  store.state = { status: 'loading' };
});

describe('useIsScriptApplied', () => {
  it('não marca nada enquanto o histórico carrega', () => {
    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);
  });

  it('não marca nada quando o histórico falha', () => {
    store.state = { status: 'error', error: 'boom' };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);
  });

  it('marca o script com execução bem-sucedida', () => {
    store.state = { status: 'success', data: [entry('cpu-1')] };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(true);
    expect(result.current({ id: 'cpu-2' })).toBe(false);
  });

  it('ignora exit code diferente de zero', () => {
    store.state = { status: 'success', data: [entry('cpu-1', { exitCode: 1 })] };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);
  });

  it('ignora exit code nulo (processo não terminou)', () => {
    store.state = { status: 'success', data: [entry('cpu-1', { exitCode: null })] };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);
  });

  it('ignora execução cancelada mesmo com exit code 0', () => {
    store.state = { status: 'success', data: [entry('cpu-1', { wasCancelled: true })] };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);
  });

  it('basta uma execução bem-sucedida entre as falhas', () => {
    store.state = {
      status: 'success',
      data: [
        entry('cpu-1', { exitCode: 1 }),
        entry('cpu-1', { id: 'history-2', wasCancelled: true }),
        entry('cpu-1', { id: 'history-3' }),
      ],
    };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(true);
  });

  it('não marca scripts não contáveis, mesmo com histórico de sucesso', () => {
    store.state = {
      status: 'success',
      data: [entry('internet-11'), entry('apps-5'), entry('cpu-2')],
    };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'internet-11' })).toBe(false);
    expect(result.current({ id: 'apps-5' })).toBe(false);
    expect(result.current({ id: 'cpu-2' })).toBe(false);
  });

  it('marca scripts contáveis que dividem categoria com os não contáveis', () => {
    store.state = { status: 'success', data: [entry('cpu-30'), entry('internet-1')] };

    const { result } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-30' })).toBe(true);
    expect(result.current({ id: 'internet-1' })).toBe(true);
  });

  it('recalcula quando o histórico muda', () => {
    const { result, rerender } = renderHook(() => useIsScriptApplied());

    expect(result.current({ id: 'cpu-1' })).toBe(false);

    store.state = { status: 'success', data: [entry('cpu-1')] };
    rerender();

    expect(result.current({ id: 'cpu-1' })).toBe(true);
  });

  it('devolve a mesma função enquanto o histórico não muda', () => {
    store.state = { status: 'success', data: [] };

    const { result, rerender } = renderHook(() => useIsScriptApplied());
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
