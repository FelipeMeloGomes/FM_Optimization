import { performance } from 'node:perf_hooks';
import type { SpeedProgress, SpeedTestPhase, SpeedTestResult } from '../../shared/ipc-types';

/**
 * Medição de velocidade contra a borda da Cloudflare. Roda no main porque o
 * CSP do renderer só permite `connect-src 'self'`. `fetch` e `now` são
 * injetáveis para que os testes exercitem o cálculo real sem depender da rede.
 */

const DOWN_URL = 'https://speed.cloudflare.com/__down';
const UP_URL = 'https://speed.cloudflare.com/__up';

export interface SpeedTestOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
  latencyCount?: number;
  downloadSizes?: number[];
  uploadSizes?: number[];
  timeoutMs?: number;
}

let activeController: AbortController | null = null;

export function cancelSpeedTest(): void {
  activeController?.abort();
}

/** Mesmo que `fetch` ignore o signal, a requisição deixa de travar o teste. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error('Requisição abortada'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[index];
}

function jitterOf(samples: number[]): number {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    total += Math.abs(samples[i] - samples[i - 1]);
  }
  return total / (samples.length - 1);
}

function toMbps(bytes: number, elapsedMs: number): number {
  const seconds = Math.max(elapsedMs, Number.EPSILON) / 1000;
  return (bytes * 8) / (seconds * 1_000_000);
}

export async function runSpeedTest(
  onProgress: (progress: SpeedProgress) => void,
  options: SpeedTestOptions = {}
): Promise<SpeedTestResult> {
  const {
    fetchFn = fetch,
    now = () => performance.now(),
    latencyCount = 10,
    downloadSizes = [100_000, 1_000_000, 10_000_000],
    uploadSizes = [100_000, 1_000_000, 10_000_000],
    timeoutMs = 10_000,
  } = options;

  const controller = new AbortController();
  activeController = controller;
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);

  const emit = (phase: SpeedTestPhase, progress: number, currentMbps: number | null = null) =>
    onProgress({ phase, progress, currentMbps });

  const checkCancelled = () => {
    if (controller.signal.aborted) throw new Error('Teste cancelado');
  };

  try {
    emit('latency', 0);
    const latencies: number[] = [];
    for (let i = 0; i < latencyCount; i++) {
      checkCancelled();
      const start = now();
      await withAbort(
        fetchFn(`${DOWN_URL}?bytes=0&r=${Math.random()}`, { cache: 'no-store', signal }),
        signal
      );
      latencies.push(now() - start);
      emit('latency', ((i + 1) / latencyCount) * 0.1);
    }

    emit('download', 0.1);
    const downloadSamples: number[] = [];
    for (let i = 0; i < downloadSizes.length; i++) {
      checkCancelled();
      const size = downloadSizes[i];
      const start = now();
      const response = await withAbort(
        fetchFn(`${DOWN_URL}?bytes=${size}&r=${Math.random()}`, { cache: 'no-store', signal }),
        signal
      );
      let bytes = 0;
      const reader = response.body?.getReader();
      if (reader) {
        for (;;) {
          const chunk = await withAbort(reader.read(), signal);
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
        }
      }
      const mbps = toMbps(bytes, now() - start);
      downloadSamples.push(mbps);
      emit('download', 0.1 + ((i + 1) / downloadSizes.length) * 0.45, mbps);
    }

    emit('upload', 0.55);
    const uploadSamples: number[] = [];
    for (let i = 0; i < uploadSizes.length; i++) {
      checkCancelled();
      const size = uploadSizes[i];
      const payload = Buffer.alloc(size, 7);
      const start = now();
      await withAbort(
        fetchFn(`${UP_URL}?r=${Math.random()}`, {
          method: 'POST',
          body: payload,
          cache: 'no-store',
          signal,
        }),
        signal
      );
      const mbps = toMbps(size, now() - start);
      uploadSamples.push(mbps);
      emit('upload', 0.55 + ((i + 1) / uploadSizes.length) * 0.45, mbps);
    }

    const result: SpeedTestResult = {
      downloadMbps: percentile(downloadSamples, 0.9),
      uploadMbps: percentile(uploadSamples, 0.9),
      pingMs: percentile(latencies, 0.5),
      jitterMs: jitterOf(latencies),
    };
    emit('done', 1);
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Teste cancelado');
    throw error;
  } finally {
    if (activeController === controller) activeController = null;
  }
}
