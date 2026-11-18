// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeedProgress, SpeedTestResult } from '../../electron/shared/ipc-types';
import { SpeedProvider, useSpeedContext } from './SpeedContext';

const RESULT: SpeedTestResult = {
  downloadMbps: 95.5,
  uploadMbps: 42.3,
  pingMs: 12,
  jitterMs: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installApi(options: { measure?: () => Promise<SpeedTestResult> } = {}) {
  let listener: ((data: SpeedProgress) => void) | null = null;
  const unsubscribe = vi.fn();
  const api = {
    measureSpeed: vi.fn(options.measure ?? (async () => RESULT)),
    cancelSpeedTest: vi.fn(async () => undefined),
    onSpeedProgress: vi.fn((cb: (data: SpeedProgress) => void) => {
      listener = cb;
      return unsubscribe;
    }),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return {
    api,
    unsubscribe,
    emit: (data: SpeedProgress) => act(() => listener?.(data)),
  };
}

function Probe() {
  const { status, progress, result, error, start, cancel } = useSpeedContext();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="phase">{progress.phase}</span>
      <span data-testid="progress">{progress.progress}</span>
      <span data-testid="current">{String(progress.currentMbps)}</span>
      <span data-testid="download">{result?.downloadMbps ?? ''}</span>
      <span data-testid="upload">{result?.uploadMbps ?? ''}</span>
      <span data-testid="ping">{result?.pingMs ?? ''}</span>
      <span data-testid="jitter">{result?.jitterMs ?? ''}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button type="button" onClick={() => void start()}>
        start
      </button>
      <button type="button" onClick={() => void cancel()}>
        cancel
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <SpeedProvider>
      <Probe />
    </SpeedProvider>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('SpeedContext', () => {
  it('registra o listener e mostra o progresso recebido ao iniciar', async () => {
    const gate = deferred<SpeedTestResult>();
    const { api, emit } = installApi({ measure: () => gate.promise });
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });

    expect(api.measureSpeed).toHaveBeenCalledTimes(1);
    expect(api.onSpeedProgress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('measuring');

    await emit({ phase: 'download', progress: 0.5, currentMbps: 42 });

    expect(screen.getByTestId('phase').textContent).toBe('download');
    expect(screen.getByTestId('progress').textContent).toBe('0.5');
    expect(screen.getByTestId('current').textContent).toBe('42');

    await act(async () => {
      gate.resolve(RESULT);
    });
  });

  it('mostra o resultado quando a medição termina', async () => {
    installApi();
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });

    expect(screen.getByTestId('status').textContent).toBe('done');
    expect(screen.getByTestId('download').textContent).toBe('95.5');
    expect(screen.getByTestId('upload').textContent).toBe('42.3');
    expect(screen.getByTestId('ping').textContent).toBe('12');
    expect(screen.getByTestId('jitter').textContent).toBe('2');
  });

  it('mostra erro quando a medição rejeita com string', async () => {
    installApi({ measure: () => Promise.reject('offline') });
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });

    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('error').textContent).toBe('offline');
  });

  it('reseta o progresso quando a medição falha no meio', async () => {
    const gate = deferred<SpeedTestResult>();
    const { emit } = installApi({ measure: () => gate.promise });
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });
    await emit({ phase: 'download', progress: 0.3, currentMbps: 42 });

    await act(async () => {
      gate.reject(new Error('offline'));
    });

    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('error').textContent).toBe('offline');
    expect(screen.getByTestId('phase').textContent).toBe('latency');
    expect(screen.getByTestId('progress').textContent).toBe('0');
    expect(screen.getByTestId('current').textContent).toBe('null');
  });

  it('cancela, volta ao estado inicial e ignora rejeição tardia', async () => {
    const gate = deferred<SpeedTestResult>();
    const { api } = installApi({ measure: () => gate.promise });
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('cancel'));
    });

    expect(api.cancelSpeedTest).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('idle');

    await act(async () => {
      gate.reject('Teste cancelado');
    });
    expect(screen.getByTestId('status').textContent).toBe('idle');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('faz unsubscribe do listener ao finalizar', async () => {
    const { unsubscribe } = installApi();
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('start'));
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
