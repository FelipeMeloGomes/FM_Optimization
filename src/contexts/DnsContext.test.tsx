// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchmarkResult, NetworkInfo } from '../../electron/shared/ipc-types';
import { DnsProvider, useDnsContext } from './DnsContext';

const NETWORK: NetworkInfo = {
  interfaceIndex: 12,
  interfaceName: 'Ethernet',
  currentDns: ['1.1.1.1'],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function installApi(options: { benchmark?: () => Promise<BenchmarkResult[]> } = {}) {
  let resultListener: ((data: BenchmarkResult) => void) | null = null;
  const api = {
    getNetworkInfo: vi.fn(async () => NETWORK),
    onBenchmarkProgress: vi.fn(() => vi.fn()),
    onBenchmarkResult: vi.fn((cb: (data: BenchmarkResult) => void) => {
      resultListener = cb;
      return vi.fn();
    }),
    benchmarkDns: vi.fn(options.benchmark ?? (async () => [])),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return {
    api,
    emit: (data: BenchmarkResult) => act(() => resultListener?.(data)),
  };
}

function Probe() {
  const { benchmarks, benchmarkStatus, runBenchmark } = useDnsContext();
  return (
    <div>
      <span data-testid="status">{benchmarkStatus}</span>
      <span data-testid="total">{benchmarks.size}</span>
      <span data-testid="segundo">{benchmarks.get('8.8.8.8')?.latencyMs ?? ''}</span>
      <button type="button" onClick={() => void runBenchmark()}>
        run
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <DnsProvider>
      <Probe />
    </DnsProvider>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('DnsContext', () => {
  it('usa o retorno do benchmark quando o evento do ultimo DNS nao chega a tempo', async () => {
    const gate = deferred<BenchmarkResult[]>();
    const { emit } = installApi({ benchmark: () => gate.promise });
    renderProbe();

    await act(async () => {
      fireEvent.click(screen.getByText('run'));
    });

    const primeiro: BenchmarkResult = { address: '9.9.9.9', latencyMs: 11 };
    const segundo: BenchmarkResult = { address: '8.8.8.8', latencyMs: 22 };
    emit(primeiro);

    await act(async () => {
      gate.resolve([primeiro, segundo]);
    });

    expect(screen.getByTestId('status').textContent).toBe('done');
    expect(screen.getByTestId('total').textContent).toBe('2');
    expect(screen.getByTestId('segundo').textContent).toBe('22');
  });
});
