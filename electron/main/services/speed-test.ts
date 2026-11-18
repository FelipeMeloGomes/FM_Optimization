import { performance } from 'node:perf_hooks';
import type { SpeedProgress, SpeedTestPhase, SpeedTestResult } from '../../shared/ipc-types';

/**
 * Medição de velocidade contra a rede pública de servidores da Ookla, a mesma
 * usada pelo Speedtest.net. Roda no main porque o CSP do renderer só permite
 * `connect-src 'self'`.
 *
 * A descoberta devolve o servidor mais perto do usuário (por geolocalização de
 * IP). Medir contra um servidor distante — como a borda da Cloudflare em SP —
 * limita a leitura à capacidade da rota, não à velocidade real da internet.
 * Várias conexões paralelas são necessárias para encher uma fibra rápida.
 */

const SERVERS_URL =
  'https://www.speedtest.net/api/js/servers?engine=js&https_functional=true&limit=10';

interface OoklaServer {
  url: string;
  host: string;
  https_functional?: number;
}

export interface SpeedTestOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
  latencyCount?: number;
  connections?: number;
  downloadBytes?: number;
  uploadBytes?: number;
  timeoutMs?: number;
  /** Intervalo mínimo entre avisos de progresso para a agulha não ficar travada. */
  progressIntervalMs?: number;
  /** Injeta servidores e evita a descoberta (usado nos testes). */
  serverUrls?: string[];
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

/**
 * Lê o corpo em pedaços e devolve os bytes recebidos. Sem stream (respostas
 * falsas dos testes) cai para `arrayBuffer` e devolve o tamanho total.
 */
async function consumeResponseBody(
  response: Response,
  onBytes: (bytes: number) => void
): Promise<number> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const bytes = (await response.arrayBuffer()).byteLength;
    onBytes(bytes);
    return bytes;
  }

  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    received += value.byteLength;
    onBytes(value.byteLength);
  }
  return received;
}

async function discoverServers(fetchFn: typeof fetch, signal: AbortSignal): Promise<string[]> {
  const response = await withAbort(fetchFn(SERVERS_URL, { cache: 'no-store', signal }), signal);
  if (!response.ok) throw new Error('Não foi possível consultar os servidores de teste');
  const servers = (await response.json()) as OoklaServer[];
  if (!Array.isArray(servers) || servers.length === 0) {
    throw new Error('Nenhum servidor de teste disponível');
  }
  return servers.map((server) =>
    server.https_functional === 1 ? `https://${server.host}` : `http://${new URL(server.url).host}`
  );
}

export async function runSpeedTest(
  onProgress: (progress: SpeedProgress) => void,
  options: SpeedTestOptions = {}
): Promise<SpeedTestResult> {
  const {
    fetchFn = fetch,
    now = () => performance.now(),
    latencyCount = 10,
    connections = 8,
    downloadBytes = 10_000_000,
    uploadBytes = 10_000_000,
    timeoutMs = 30_000,
    progressIntervalMs = 60,
    serverUrls,
  } = options;

  const controller = new AbortController();
  activeController = controller;
  const cancelSignal = controller.signal;

  /** Cada requisição ganha o seu próprio cronômetro, não um orçamento global. */
  const requestSignal = () => AbortSignal.any([cancelSignal, AbortSignal.timeout(timeoutMs)]);

  const emit = (phase: SpeedTestPhase, progress: number, currentMbps: number | null = null) =>
    onProgress({ phase, progress, currentMbps });

  const checkCancelled = () => {
    if (cancelSignal.aborted) throw new Error('Teste cancelado');
  };

  try {
    emit('latency', 0);
    const urls = serverUrls ?? (await discoverServers(fetchFn, cancelSignal));
    const base = urls[0];
    if (!base) throw new Error('Nenhum servidor de teste disponível');

    const latencies: number[] = [];
    for (let i = 0; i < latencyCount; i++) {
      checkCancelled();
      const start = now();
      const signal = requestSignal();
      await withAbort(
        fetchFn(`${base}/speedtest/download?size=0&r=${Math.random()}`, {
          cache: 'no-store',
          signal,
        }),
        signal
      );
      latencies.push(now() - start);
      emit('latency', ((i + 1) / latencyCount) * 0.1);
    }

    // Sondagem curta: em banda baixa, 8×10 MB levaria mais que o timeout.
    const probeStart = now();
    const probeSignal = requestSignal();
    const probeResponse = await withAbort(
      fetchFn(`${base}/speedtest/download?size=1000000&r=${Math.random()}`, {
        cache: 'no-store',
        signal: probeSignal,
      }),
      probeSignal
    );
    await probeResponse.arrayBuffer();
    const probeMbps = toMbps(1_000_000, now() - probeStart);
    const fast = probeMbps >= 100;
    const activeConnections = fast ? connections : Math.min(connections, 4);
    const activeDownloadBytes = fast ? downloadBytes : Math.min(downloadBytes, 1_000_000);
    const activeUploadBytes = fast ? uploadBytes : Math.min(uploadBytes, 1_000_000);

    // Progresso usa relógio de parede: o relógio injetado mede apenas o resultado
    // final, e os testes não devem mudar por causa da frequência dos avisos.
    const streamed = (phase: SpeedTestPhase, from: number, span: number, total: number) => {
      const startWall = Date.now();
      let bytes = 0;
      let lastEmit = 0;
      return (chunk: number) => {
        bytes += chunk;
        const wall = Date.now();
        if (wall - lastEmit < progressIntervalMs) return;
        lastEmit = wall;
        const fraction = Math.min(0.95, bytes / total);
        emit(phase, from + fraction * span, toMbps(bytes, wall - startWall));
      };
    };

    const downloadTotal = activeDownloadBytes * activeConnections;
    emit('download', 0.1, 0);
    const downloadStart = now();
    const onDownloadBytes = streamed('download', 0.1, 0.45, downloadTotal);
    await Promise.all(
      Array.from({ length: activeConnections }, () => {
        const signal = requestSignal();
        return withAbort(
          fetchFn(`${base}/speedtest/download?size=${activeDownloadBytes}&r=${Math.random()}`, {
            cache: 'no-store',
            signal,
          }),
          signal
        ).then((response) => consumeResponseBody(response, onDownloadBytes));
      })
    );
    const downloadMbps = toMbps(downloadTotal, now() - downloadStart);
    emit('download', 0.55, downloadMbps);

    // Upload com `Content-Length` fixo: o servidor da Ookla não aceita corpo em
    // stream (chunked). O progresso é interpolado a partir da sondagem enquanto
    // as requisições estão em voo; o valor final medido substitui a estimativa.
    emit('upload', 0.55, 0);
    const payload = Buffer.alloc(activeUploadBytes, 7);
    const uploadTotal = activeUploadBytes * activeConnections;
    const uploadStart = now();
    const estimatedSpeed = Math.max(downloadMbps, probeMbps, 50);
    // O upload costuma terminar antes do tempo estimado pela sondagem; deixa a
    // barra circular mais devagar para o salto final para 100% não parecer brusco.
    const estimateMs = Math.max(800, ((uploadTotal * 8) / (estimatedSpeed * 1e6)) * 1000);
    const uploadWallStart = Date.now();
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - uploadWallStart;
      const fraction = Math.min(0.9, elapsed / estimateMs);
      // A estimativa sobe aos poucos, como a subida da agulha no Speedtest.net.
      // Um valor constante deixava a agulha parada durante todo o upload.
      const ramp = Math.min(1, fraction * 1.3);
      emit('upload', 0.55 + fraction * 0.44, estimatedSpeed * (0.12 + 0.88 * ramp));
    }, progressIntervalMs);

    try {
      await Promise.all(
        Array.from({ length: activeConnections }, () => {
          const signal = requestSignal();
          return withAbort(
            fetchFn(`${base}/speedtest/upload?r=${Math.random()}`, {
              method: 'POST',
              body: payload,
              cache: 'no-store',
              signal,
            }),
            signal
          );
        })
      );
    } finally {
      clearInterval(progressTimer);
    }
    const uploadMbps = toMbps(uploadTotal, now() - uploadStart);
    emit('upload', 1, uploadMbps);

    const result: SpeedTestResult = {
      downloadMbps,
      uploadMbps,
      pingMs: percentile(latencies, 0.5),
      jitterMs: jitterOf(latencies),
    };
    emit('done', 1);
    return result;
  } catch (error) {
    if (cancelSignal.aborted) throw new Error('Teste cancelado');
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('O servidor demorou para responder. Tente novamente.');
    }
    throw error;
  } finally {
    if (activeController === controller) activeController = null;
  }
}
