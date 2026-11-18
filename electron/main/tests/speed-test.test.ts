import { describe, expect, it, vi } from 'vitest';
import { cancelSpeedTest, runSpeedTest } from '../services/speed-test';

/**
 * O serviço mede de verdade com `fetch` e relógio injetados. Os mocks ficam na
 * fronteira de rede: o cálculo de Mbps, mediana, jitter e progresso é sempre o
 * código de produção. `timeoutMs` existe para o teste de travamento não esperar
 * os 10 s do padrão.
 */

function responseWithBytes(bytes: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes > 0) controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  return { body, ok: true } as unknown as Response;
}

const fakeFetch: typeof fetch = async (input, init) => {
  if (init?.method === 'POST') return responseWithBytes(0);
  const bytes = Number(new URL(String(input)).searchParams.get('bytes') ?? 0);
  return responseWithBytes(bytes);
};

function fakeClock(stepMs: number): () => number {
  let time = 0;
  return () => (time += stepMs);
}

const baseOptions = {
  fetchFn: fakeFetch,
  now: fakeClock(100),
  latencyCount: 3,
  downloadSizes: [1000],
  uploadSizes: [1000],
  timeoutMs: 200,
};

describe('speed-test', () => {
  it('mede download, upload, ping e jitter e publica progresso em ordem', async () => {
    const progress: Array<{ phase: string; progress: number; currentMbps: number | null }> = [];

    const result = await runSpeedTest((p) => progress.push(p), {
      ...baseOptions,
      now: fakeClock(100),
    });

    expect(result).toEqual({ downloadMbps: 0.08, uploadMbps: 0.08, pingMs: 100, jitterMs: 0 });
    expect([...new Set(progress.map((p) => p.phase))]).toEqual([
      'latency',
      'download',
      'upload',
      'done',
    ]);
    expect(progress.at(-1)?.progress).toBe(1);
  });

  it('rejeita com a mensagem do fetch quando a rede falha', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await expect(runSpeedTest(() => {}, { ...baseOptions, fetchFn: failingFetch })).rejects.toThrow(
      'offline'
    );
  });

  it('rejeita com Teste cancelado quando cancelSpeedTest é chamado durante a medição', async () => {
    const slowFetch = (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const promise = runSpeedTest(() => {}, {
      ...baseOptions,
      fetchFn: slowFetch as typeof fetch,
    });

    cancelSpeedTest();

    await expect(promise).rejects.toThrow('Teste cancelado');
  });

  it('não gera NaN nem Infinity quando o relógio não avança', async () => {
    const result = await runSpeedTest(() => {}, { ...baseOptions, now: () => 1000 });

    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });

  it('aplica timeout por requisição', async () => {
    const pending = new Promise<Response>(() => {});

    await expect(
      runSpeedTest(() => {}, {
        ...baseOptions,
        fetchFn: vi.fn(() => pending) as unknown as typeof fetch,
        latencyCount: 1,
        timeoutMs: 10,
      })
    ).rejects.toThrow();
  });
});
