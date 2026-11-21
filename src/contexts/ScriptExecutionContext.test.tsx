// @vitest-environment jsdom
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEnded, ScriptEntry } from '../../electron/shared/ipc-types';

import { ScriptExecutionProvider, useScriptExecutionContext } from './ScriptExecutionContext';

function installApi() {
  const listeners: ((data: ScriptEnded) => void)[] = [];
  const offScriptEnded = vi.fn((cb: (data: ScriptEnded) => void) => {
    const index = listeners.indexOf(cb);
    if (index >= 0) listeners.splice(index, 1);
    return () => undefined;
  });
  const api = {
    executeScript: vi.fn<(id: string) => Promise<void>>(async () => undefined),
    cancelExecution: vi.fn<(id: string) => Promise<void>>(async () => undefined),
    onScriptEnded: vi.fn((cb: (data: ScriptEnded) => void) => {
      listeners.push(cb);
      return offScriptEnded;
    }),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return {
    api,
    offScriptEnded,
    emitScriptEnded(data: ScriptEnded) {
      listeners.forEach((cb) => {
        cb(data);
      });
    },
  };
}

function script(id: string, overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id,
    name: id,
    description: '',
    category: '',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
    ...overrides,
  };
}

function renderBatchHook() {
  return renderHook(() => useScriptExecutionContext(), { wrapper: ScriptExecutionProvider });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const { activeExecution, execute, cancel } = useScriptExecutionContext();
  return (
    <div>
      <span data-testid="active">{activeExecution ?? 'none'}</span>
      <button
        type="button"
        onClick={() => {
          void execute('a');
        }}
      >
        executar a
      </button>
      <button
        type="button"
        onClick={() => {
          void execute('b');
        }}
      >
        executar b
      </button>
      <button
        type="button"
        onClick={() => {
          void cancel('a');
        }}
      >
        cancelar a
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ScriptExecutionProvider>
      <Probe />
    </ScriptExecutionProvider>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('ScriptExecutionProvider', () => {
  it('começa sem execução ativa', () => {
    installApi();
    renderProvider();

    expect(screen.getByTestId('active').textContent).toBe('none');
  });

  it('marca o script ativo e delega ao main', async () => {
    const harness = installApi();
    renderProvider();

    await act(async () => screen.getByRole('button', { name: 'executar a' }).click());

    expect(screen.getByTestId('active').textContent).toBe('a');
    expect(harness.api.executeScript).toHaveBeenCalledWith('a');
  });

  it('mostra o script ativo enquanto a execução não retorna', async () => {
    const harness = installApi();
    const pending = deferred();
    harness.api.executeScript.mockImplementation(() => pending.promise);
    renderProvider();

    act(() => screen.getByRole('button', { name: 'executar b' }).click());
    expect(screen.getByTestId('active').textContent).toBe('b');

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(screen.getByTestId('active').textContent).toBe('b');
  });

  it('limpa a execução ativa quando o main rejeita a chamada', async () => {
    const harness = installApi();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.api.executeScript.mockRejectedValue(new Error('sem permissão'));
    renderProvider();

    await act(async () => screen.getByRole('button', { name: 'executar a' }).click());

    expect(screen.getByTestId('active').textContent).toBe('none');
    expect(consoleError).toHaveBeenCalledWith('Failed to execute script:', expect.any(Error));

    consoleError.mockRestore();
  });

  it('cancela a execução e limpa o estado', async () => {
    const harness = installApi();
    renderProvider();
    await act(async () => screen.getByRole('button', { name: 'executar a' }).click());
    expect(screen.getByTestId('active').textContent).toBe('a');

    await act(async () => screen.getByRole('button', { name: 'cancelar a' }).click());

    expect(harness.api.cancelExecution).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('active').textContent).toBe('none');
  });

  it('limpa o estado mesmo quando o cancelamento falha', async () => {
    const harness = installApi();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.api.cancelExecution.mockRejectedValue(new Error('não cancelou'));
    renderProvider();
    await act(async () => screen.getByRole('button', { name: 'executar a' }).click());

    await act(async () => screen.getByRole('button', { name: 'cancelar a' }).click());

    expect(screen.getByTestId('active').textContent).toBe('none');
    expect(consoleError).toHaveBeenCalledWith('Failed to cancel script:', expect.any(Error));

    consoleError.mockRestore();
  });

  it('limpa a execução ativa quando o script termina', async () => {
    const harness = installApi();
    renderProvider();
    await act(async () => screen.getByRole('button', { name: 'executar a' }).click());

    act(() => harness.emitScriptEnded({ id: 'a', code: 0 }));

    expect(screen.getByTestId('active').textContent).toBe('none');
  });

  it('ignora o fim de um script diferente do ativo', async () => {
    const harness = installApi();
    renderProvider();
    await act(async () => screen.getByRole('button', { name: 'executar b' }).click());

    act(() => harness.emitScriptEnded({ id: 'a', code: 0 }));

    expect(screen.getByTestId('active').textContent).toBe('b');
  });

  it('remove o listener de script terminado ao desmontar', async () => {
    const harness = installApi();
    const { unmount } = renderProvider();
    await waitFor(() => expect(harness.api.onScriptEnded).toHaveBeenCalledTimes(1));

    unmount();

    expect(harness.offScriptEnded).toHaveBeenCalledTimes(1);
  });
});

describe('executeBatch', () => {
  it('executa o lote em sequência aguardando o fim de cada script', async () => {
    const harness = installApi();
    const { result } = renderBatchHook();
    const A = script('a');
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    expect(harness.api.executeScript).toHaveBeenCalledTimes(1);
    expect(result.current.batch).toEqual({ ids: ['a', 'b'], index: 1 });

    await act(async () => {
      harness.emitScriptEnded({ id: 'a', code: 0 });
      await Promise.resolve();
    });

    expect(harness.api.executeScript).toHaveBeenNthCalledWith(2, 'b');
    expect(result.current.batch).toEqual({ ids: ['a', 'b'], index: 2 });

    await act(async () => {
      harness.emitScriptEnded({ id: 'b', code: 0 });
      await pending;
    });

    expect(result.current.batch).toBeNull();
    expect(await pending).toEqual({ failedIds: [] });
  });

  it('registra falha quando o código não é zero e roda o próximo script', async () => {
    const harness = installApi();
    const { result } = renderBatchHook();
    const A = script('a');
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    await act(async () => {
      harness.emitScriptEnded({ id: 'a', code: 1 });
      await Promise.resolve();
    });

    expect(harness.api.executeScript).toHaveBeenNthCalledWith(2, 'b');

    await act(async () => {
      harness.emitScriptEnded({ id: 'b', code: 0 });
      await pending;
    });

    expect(await pending).toEqual({ failedIds: ['a'] });
  });

  it('com cancelamento no script atual não falha e libera o próximo script', async () => {
    const harness = installApi();
    const { result } = renderBatchHook();
    const A = script('a');
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    await act(async () => {
      harness.emitScriptEnded({ id: 'a', code: null, cancelled: true });
      await Promise.resolve();
    });

    expect(harness.api.executeScript).toHaveBeenNthCalledWith(2, 'b');

    await act(async () => {
      harness.emitScriptEnded({ id: 'b', code: 0 });
      await pending;
    });

    expect(await pending).toEqual({ failedIds: [] });
  });

  it('scripts interativos não têm timeout; scripts não interativos estouram em 30 minutos', async () => {
    vi.useFakeTimers();
    const harness = installApi();
    const { result } = renderBatchHook();
    const A = script('a', { interactive: true });
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000);
    });
    expect(harness.api.executeScript).toHaveBeenCalledTimes(1);

    await act(async () => {
      harness.emitScriptEnded({ id: 'a', code: 0 });
      await Promise.resolve();
    });
    expect(harness.api.executeScript).toHaveBeenNthCalledWith(2, 'b');

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    await act(async () => {
      await pending;
    });

    expect(await pending).toEqual({ failedIds: ['b'] });
    vi.useRealTimers();
  });

  it('desmonta o provider durante o lote e resolve a promise sem iniciar o próximo script', async () => {
    vi.useFakeTimers();
    const harness = installApi();
    const { result, unmount } = renderBatchHook();
    const A = script('a');
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    expect(harness.api.executeScript).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    await pending;

    expect(harness.api.executeScript).toHaveBeenCalledTimes(1);
    expect(await pending).toEqual({ failedIds: [] });
    vi.useRealTimers();
  });

  it('limpa a execução ativa quando o script estoura o timeout', async () => {
    vi.useFakeTimers();
    const harness = installApi();
    const { result } = renderBatchHook();
    const A = script('a');
    const B = script('b');

    let pending!: Promise<{ failedIds: string[] }>;
    await act(async () => {
      pending = result.current.executeBatch([A, B]);
      await Promise.resolve();
    });

    expect(result.current.activeExecution).toBe('a');

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });
    expect(harness.api.executeScript).toHaveBeenNthCalledWith(2, 'b');

    await act(async () => {
      harness.emitScriptEnded({ id: 'b', code: 0 });
      await pending;
    });

    expect(await pending).toEqual({ failedIds: ['a'] });
    expect(result.current.activeExecution).toBeNull();
    expect(result.current.batch).toBeNull();
    vi.useRealTimers();
  });
});

describe('useScriptExecutionContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useScriptExecutionContext must be used within ScriptExecutionProvider'
    );

    consoleError.mockRestore();
  });
});
