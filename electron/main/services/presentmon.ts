import { spawn } from 'node:child_process';
import { createHash as nodeCreateHash } from 'node:crypto';
import {
  existsSync as fsExistsSync,
  mkdirSync as fsMkdirSync,
  readFileSync as fsReadFileSync,
  renameSync as fsRenameSync,
  writeFileSync as fsWriteFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getDataDir } from './data-service';

export const PRESENTMON_VERSION = '2.3.1';
export const PRESENTMON_SHA256 = '364e5d98d4d134bd54dd25c22ed2ca2f4883f8bc3ed6502bee0c151e3436d30c';
const PRESENTMON_FILENAME = `PresentMon-${PRESENTMON_VERSION}-x64.exe`;
export const PRESENTMON_URL = `https://github.com/GameTechDev/PresentMon/releases/download/v${PRESENTMON_VERSION}/${PRESENTMON_FILENAME}`;

interface HashLike {
  update(data: Buffer | string): HashLike;
  digest(encoding: 'hex'): string;
}
type CreateHash = (algorithm: 'sha256') => HashLike;

interface EnsureDeps {
  fetchFn?: typeof fetch;
  existsSync?: (path: string) => boolean;
  readFileSync?: (path: string) => Buffer;
  writeFileSync?: (path: string, data: Buffer) => void;
  renameSync?: (from: string, to: string) => void;
  mkdirSync?: (path: string, options?: { recursive?: boolean }) => void;
  createHash?: CreateHash;
}

interface CaptureChild {
  stdout: { on(event: string, cb: (chunk: Buffer) => void): void };
  stderr: { on(event: string, cb: (chunk: Buffer) => void): void };
  on(event: string, cb: (value: unknown) => void): void;
  kill(): void;
}

interface CaptureDeps {
  binaryPath?: string;
  spawn?: (command: string, args: string[]) => CaptureChild;
  onError?: (message: string) => void;
}

export function binaryPath(): string {
  return resolve(getDataDir(), 'tools', PRESENTMON_FILENAME);
}

/** Argumentos reais do PresentMon para uma captura contínua em stdout. */
export function buildPresentMonArgs(processName: string): string[] {
  return [
    '--process_name',
    processName,
    '--output_stdout',
    '--no_console_stats',
    '--stop_existing_session',
    '--terminate_on_proc_exit',
  ];
}

/** Extrai o intervalo entre presents (ms) de uma linha do CSV. */
export function parseCsvSample(line: string, header: string[]): number | null {
  const index = header.indexOf('MsBetweenPresents');
  if (index < 0) return null;
  const raw = line.split(',')[index]?.trim().replace(/^"|"$/g, '');
  if (!raw) return null;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** FPS derivado das amostras recentes — média suavizada de ~1 segundo. */
export function computeSmoothedFps(samplesMs: number[]): number | null {
  const valid = samplesMs.filter((ms) => Number.isFinite(ms) && ms > 0);
  if (valid.length === 0) return null;
  const mean = valid.reduce((total, ms) => total + ms, 0) / valid.length;
  const fps = 1000 / mean;
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps) : null;
}

export function frameColor(fps: number, targetFps: number): 'good' | 'bad' {
  return fps >= targetFps ? 'good' : 'bad';
}

/**
 * Garante que o binário do PresentMon existe e íntegro. Baixa do release
 * oficial e valida SHA256 antes de usar; nunca executa um arquivo suspeito.
 */
export async function ensurePresentMon(
  deps: EnsureDeps = {}
): Promise<{ path: string } | { error: string }> {
  const path = binaryPath();
  const exists = deps.existsSync ?? fsExistsSync;
  const read = deps.readFileSync ?? fsReadFileSync;
  const makeHash = deps.createHash ?? (nodeCreateHash as CreateHash);

  if (exists(path)) {
    try {
      if (makeHash('sha256').update(read(path)).digest('hex').toLowerCase() === PRESENTMON_SHA256) {
        return { path };
      }
    } catch {
      // Arquivo ilegível: baixa novamente.
    }
  }

  try {
    const fetchFn = deps.fetchFn ?? fetch;
    const response = await fetchFn(PRESENTMON_URL);
    if (!response.ok) {
      return { error: `Falha ao baixar o PresentMon (HTTP ${response.status}).` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (makeHash('sha256').update(buffer).digest('hex').toLowerCase() !== PRESENTMON_SHA256) {
      return { error: 'Integridade do PresentMon falhou: hash SHA256 divergente.' };
    }
    const mkdir = deps.mkdirSync ?? fsMkdirSync;
    const write = deps.writeFileSync ?? fsWriteFileSync;
    const rename = deps.renameSync ?? fsRenameSync;
    mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    write(tmp, buffer);
    rename(tmp, path);
    return { path };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Não foi possível obter o PresentMon: ${message}` };
  }
}

/** Inicia a captura e devolve uma função que encerra o processo. */
export function startCapture(
  processName: string,
  onMs: (ms: number) => void,
  deps: CaptureDeps = {}
): () => void {
  const binary = deps.binaryPath ?? binaryPath();
  const spawnFn =
    deps.spawn ??
    ((command: string, args: string[]) =>
      spawn(command, args, { windowsHide: true }) as unknown as CaptureChild);
  const child = spawnFn(binary, buildPresentMonArgs(processName));

  let header: string[] | null = null;
  let pending = '';

  const consume = (chunk: Buffer): void => {
    pending += chunk.toString('utf-8');
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      if (header === null) {
        header = line.split(',').map((column) => column.trim().replace(/^"|"$/g, ''));
        continue;
      }
      const ms = parseCsvSample(line, header);
      if (ms !== null) onMs(ms);
    }
  };

  child.stdout.on('data', consume);
  child.stderr.on('data', () => {
    // PresentMon escreve diagnóstico no stderr; o FPS vem do stdout.
  });
  child.on('error', (value: unknown) => {
    deps.onError?.(value instanceof Error ? value.message : String(value));
  });

  return () => {
    child.kill();
  };
}
