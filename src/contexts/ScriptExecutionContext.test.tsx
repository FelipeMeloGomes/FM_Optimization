// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEnded } from '../../electron/shared/ipc-types';

import { ScriptExecutionProvider, useScriptExecutionContext } from './ScriptExecutionContext';

function installApi() {
  let endedCb: ((data: ScriptEnded) => void) | null = null;
  const offScriptEnded = vi.fn();
  const api = {
    executeScript: vi.fn<(id: string) => Promise<void>>(async () => undefined),
    cancelExecution: vi.fn<(id: string) => Promise<void>>(async () => undefined),
    onScriptEnded: vi.fn((cb: (data: ScriptEnded) => void) => {
      endedCb = cb;
      return offScriptEnded;
    }),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return {
    api,
    offScriptEnded,
    emitScriptEnded(data: ScriptEnded) {
      endedCb?.(data);
    },
  };
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

describe('useScriptExecutionContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useScriptExecutionContext must be used within ScriptExecutionProvider'
    );

    consoleError.mockRestore();
  });
});
