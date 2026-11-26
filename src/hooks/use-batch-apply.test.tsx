// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useBatchApply } from './use-batch-apply';

function script(id: string): ScriptEntry {
  return {
    id,
    name: `Script ${id}`,
    description: '',
    category: 'CPU',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const A = script('a');
const B = script('b');

describe('useBatchApply', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('marca somente os scripts devolvidos como falha', async () => {
    const executeBatch = vi.fn(async () => ({ failedIds: ['b'] }));
    const { result } = renderHook(() => useBatchApply(executeBatch));

    act(() => result.current.runBatch([A, B]));

    await waitFor(() => expect(result.current.failedScripts.map((s) => s.id)).toEqual(['b']));
    expect(executeBatch).toHaveBeenCalledWith([A, B]);
  });

  it('marca todos como falha e registra o erro quando o lote é recusado', async () => {
    const error = new Error('serviço indisponível');
    const executeBatch = vi.fn(() => Promise.reject(error));
    const { result } = renderHook(() => useBatchApply(executeBatch));

    act(() => result.current.runBatch([A, B]));

    await waitFor(() => expect(result.current.failedScripts.map((s) => s.id)).toEqual(['a', 'b']));
    expect(consoleErrorSpy).toHaveBeenCalledWith('Falha ao aplicar o lote de scripts:', error);
  });

  it('limpa as falhas', async () => {
    const executeBatch = vi.fn(async () => ({ failedIds: ['a'] }));
    const { result } = renderHook(() => useBatchApply(executeBatch));

    act(() => result.current.runBatch([A]));
    await waitFor(() => expect(result.current.failedScripts).toHaveLength(1));

    act(() => result.current.clearFailures());
    expect(result.current.failedScripts).toEqual([]);
  });
});
