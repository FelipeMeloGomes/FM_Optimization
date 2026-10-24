import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from 'electron';

interface InstanceInfo {
  pid: number;
  elevated: boolean;
  startedAt: string;
}

interface HandoverRequest {
  pid: number;
  requestedAt: string;
}

const INSTANCE_FILE = 'instance.json';
const HANDOVER_FILE = 'handover.json';

function statePath(name: string): string {
  return resolve(app.getPath('userData'), name);
}

function readJson<T>(name: string): T | null {
  const file = statePath(name);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as T;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown): void {
  const file = statePath(name);
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(value), 'utf-8');
    renameSync(tmp, file);
  } catch {
    // Sem permissão de escrita: o handshake degrada para o diálogo.
  }
}

function removeFile(name: string): void {
  try {
    rmSync(statePath(name), { force: true });
  } catch {
    /* já removido */
  }
}

export function writeInstanceInfo(info: InstanceInfo): void {
  writeJson(INSTANCE_FILE, info);
}

export function readInstanceInfo(): InstanceInfo | null {
  const raw = readJson<Partial<InstanceInfo>>(INSTANCE_FILE);
  if (!raw || typeof raw.pid !== 'number' || !Number.isFinite(raw.pid)) return null;
  return {
    pid: raw.pid,
    elevated: raw.elevated === true,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : '',
  };
}

/** Remove o arquivo só se ainda pertencer ao pid informado (evita apagar o do vizinho). */
export function clearInstanceInfo(pid: number): void {
  const current = readInstanceInfo();
  if (!current || current.pid === pid) removeFile(INSTANCE_FILE);
}

export function writeHandoverRequest(pid: number): void {
  writeJson(HANDOVER_FILE, { pid, requestedAt: new Date().toISOString() });
}

export function readHandoverRequest(): HandoverRequest | null {
  const raw = readJson<Partial<HandoverRequest>>(HANDOVER_FILE);
  if (!raw || typeof raw.pid !== 'number') return null;
  return {
    pid: raw.pid,
    requestedAt: typeof raw.requestedAt === 'string' ? raw.requestedAt : '',
  };
}

export function clearHandoverRequest(): void {
  removeFile(HANDOVER_FILE);
}

/**
 * `process.kill(pid, 0)` não mata nada: só testa existência. EPERM significa
 * "existe, mas em outro nível de integridade" — ou seja, vivo.
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

/** Polling assíncrono: não bloqueia o main enquanto a instância antiga encerra. */
export async function waitForProcessExit(
  pid: number,
  timeoutMs: number,
  intervalMs = 120
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await sleep(intervalMs);
  }
  return !isProcessAlive(pid);
}

/** Lê `--flag=123`; devolve null quando ausente ou inválido. */
export function readNumericArg(argv: string[], flag: string): number | null {
  const prefix = `${flag}=`;
  const entry = argv.find((arg) => arg.startsWith(prefix));
  if (!entry) return null;
  const value = Number.parseInt(entry.slice(prefix.length), 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}
