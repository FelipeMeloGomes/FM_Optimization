import { describe, expect, it, vi } from 'vitest';
import { cancelSpeedTest, runSpeedTest } from '../services/speed-test';

/**
 * O serviço mede de verdade com `fetch` e relógio injetados. Os mocks ficam na
 * fronteira de rede: o cálculo de Mbps, mediana, jitter e progresso é sempre o
 * código de produção. `serverUrls` evita a descoberta nos testes, exceto onde
 * ela é justamente o comportamento testado.
 */

function responseWithBytes(bytes: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  return {
    body,
    ok: true,
    status: 200,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Response;
}

const fakeFetch: typeof fetch = async (input, init) => {
  if (init?.method === 'POST') return responseWithBytes(0);
  const size = Number(new URL(String(input)).searchParams.get('size') ?? 0);
  return responseWithBytes(size);
};

function fakeClock(stepMs: number): () => number {
  let time = 0;
  return () => (time += stepMs);
}

const baseOptions = {
  fetchFn: fakeFetch,
  now: fakeClock(100),
  latencyCount: 3,
  connections: 1,
  downloadBytes: 1000,
  uploadBytes: 1000,
  timeoutMs: 200,
  serverUrls: ['https://speedtest.local:8080'],
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

  it('descobre o servidor mais perto do usuario', async () => {
    const discovery = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          host: 'speedtest.local.prod.hosts.ooklaserver.net:8080',
          url: 'http://speedtest.local:8080/speedtest/upload.php',
          https_functional: 1,
        },
      ],
    })) as unknown as typeof fetch;
    const requested: string[] = [];
    const fetchFn = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requested.push(String(input));
      if (String(input).includes('api/js/servers')) return discovery(input, init);
      return fakeFetch(input, init);
    }) as typeof fetch;

    await runSpeedTest(() => {}, { ...baseOptions, fetchFn, serverUrls: undefined });

    expect(requested.some((url) => url.includes('api/js/servers'))).toBe(true);
    expect(
      requested.some((url) =>
        url.startsWith('https://speedtest.local.prod.hosts.ooklaserver.net:8080/')
      )
    ).toBe(true);
  });

  it('rejeita com a mensagem do fetch quando a rede falha', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await expect(runSpeedTest(() => {}, { ...baseOptions, fetchFn: failingFetch })).rejects.toThrow(
      'offline'
    );
  });

  it('rejeita com Teste cancelado quando cancelSpeedTest é chamado durante a medição', async () => {
    const signals: AbortSignal[] = [];
    const slowFetch = (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    };
    const promise = runSpeedTest(() => {}, {
      ...baseOptions,
      fetchFn: slowFetch as typeof fetch,
    });

    cancelSpeedTest();

    await expect(promise).rejects.toThrow('Teste cancelado');
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
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

  it('usa conexões paralelas no download em vez de uma única conexão sequencial', async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/speedtest/upload')) return responseWithBytes(0);
      const size = Number(new URL(url).searchParams.get('size') ?? 0);
      return responseWithBytes(size);
    }) as unknown as typeof fetch;

    await runSpeedTest(() => {}, {
      ...baseOptions,
      fetchFn,
      connections: 4,
    });

    const downloads = urls.filter(
      (url) =>
        url.includes('/speedtest/download') && new URL(url).searchParams.get('size') === '1000'
    );
    expect(downloads.length).toBe(4);
  });

  it('emite progresso real enquanto os bytes chegam, sem esperar o resultado final', async () => {
    const progress: Array<{ phase: string; progress: number; currentMbps: number | null }> = [];
    const streamedResponse = (): Response =>
      ({
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(250));
            controller.enqueue(new Uint8Array(250));
            controller.enqueue(new Uint8Array(250));
            controller.enqueue(new Uint8Array(250));
            controller.close();
          },
        }),
        arrayBuffer: async () => new Uint8Array(1000).buffer,
      }) as unknown as Response;

    const fetchFn = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') return responseWithBytes(0);
      const size = Number(new URL(url).searchParams.get('size') ?? 0);
      return size === 1000 ? streamedResponse() : responseWithBytes(size);
    }) as typeof fetch;

    await runSpeedTest((p) => progress.push(p), {
      ...baseOptions,
      fetchFn,
      progressIntervalMs: 0,
    });

    const downloading = progress.filter((p) => p.phase === 'download');
    expect(downloading.length).toBeGreaterThan(3);
    expect(downloading[0]?.currentMbps).toBe(0);
    expect(downloading[1]?.currentMbps).toBeGreaterThan(0);
    expect(downloading.at(-1)?.currentMbps).toBeGreaterThan(0);
  });

  it('mantém o progresso do upload em movimento com corpo de tamanho fixo', async () => {
    const progress: Array<{ phase: string; progress: number; currentMbps: number | null }> = [];
    const fetchFn = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return responseWithBytes(0);
      }
      return fakeFetch(input, init);
    }) as typeof fetch;

    await runSpeedTest((p) => progress.push(p), {
      ...baseOptions,
      fetchFn,
      progressIntervalMs: 5,
    });

    const uploading = progress.filter((p) => p.phase === 'upload');
    expect(uploading.length).toBeGreaterThan(3);
    expect(
      uploading.some((p) => p.progress > 0.55 && p.progress < 1 && (p.currentMbps ?? 0) > 0)
    ).toBe(true);
    expect(uploading.at(-1)?.progress).toBe(1);
  });

  it('faz a estimativa de upload subir gradualmente para a agulha não ficar travada', async () => {
    const progress: Array<{ phase: string; progress: number; currentMbps: number | null }> = [];
    const fetchFn = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return responseWithBytes(0);
      }
      return fakeFetch(input, init);
    }) as typeof fetch;

    await runSpeedTest((p) => progress.push(p), {
      ...baseOptions,
      fetchFn,
      progressIntervalMs: 5,
    });

    const intermediate = progress.filter(
      (p) => p.phase === 'upload' && p.progress > 0.55 && p.progress < 1
    );
    const values = intermediate.map((p) => p.currentMbps ?? 0);
    expect(values.length).toBeGreaterThan(4);
    expect(new Set(values.map((v) => Math.round(v))).size).toBeGreaterThan(3);
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values) * 2);
  });

  it('o timeout é independente para cada requisição sequencial', async () => {
    // Cada requisição de latência leva 15 ms. Com um timeout global de 20 ms a
    // segunda abortaria aos 5 ms de vida; por requisição, ambas têm 20 ms.
    const fetchFn = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return responseWithBytes(0);
    }) as typeof fetch;

    await expect(
      runSpeedTest(() => {}, {
        ...baseOptions,
        fetchFn,
        latencyCount: 2,
        timeoutMs: 20,
      })
    ).resolves.toBeDefined();
  });
});
