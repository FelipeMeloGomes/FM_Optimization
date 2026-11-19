import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => 'C:\\UserData' },
}));

import {
  buildPresentMonArgs,
  computeSmoothedFps,
  ensurePresentMon,
  frameColor,
  PRESENTMON_SHA256,
  PRESENTMON_VERSION,
  parseCsvSample,
  startCapture,
} from '../services/presentmon';

const HEADER = ['Application', 'ProcessID', 'MsBetweenPresents', 'MsGPUTime'];

function fakeFetch(buffer: ArrayBuffer): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => buffer,
  })) as unknown as typeof fetch;
}

function fakeHash(digest: string) {
  return () => ({
    update() {
      return this;
    },
    digest: () => digest,
  });
}

describe('PresentMon', () => {
  it('usa a versão fixada e o hash publicado no release', () => {
    expect(PRESENTMON_VERSION).toBe('2.3.1');
    expect(PRESENTMON_SHA256).toBe(
      '364e5d98d4d134bd54dd25c22ed2ca2f4883f8bc3ed6502bee0c151e3436d30c'
    );
  });

  it('monta argumentos reais de captura', () => {
    const args = buildPresentMonArgs('cs2.exe');
    expect(args[args.indexOf('--process_name') + 1]).toBe('cs2.exe');
    for (const flag of [
      '--output_stdout',
      '--terminate_on_proc_exit',
      '--stop_existing_session',
      '--no_console_stats',
    ]) {
      expect(args).toContain(flag);
    }
  });

  it('extrai MsBetweenPresents do CSV e ignora linhas inválidas', () => {
    expect(parseCsvSample('cs2.exe,10,16.67,5.2', HEADER)).toBe(16.67);
    expect(parseCsvSample('cs2.exe,10,NA,5.2', HEADER)).toBeNull();
    expect(parseCsvSample('curto', HEADER)).toBeNull();
  });

  it('calcula FPS suavizado pela média das amostras', () => {
    expect(computeSmoothedFps(Array(60).fill(10))).toBe(100);
    expect(computeSmoothedFps([])).toBeNull();
    expect(computeSmoothedFps([0, 0])).toBeNull();
  });

  it('colore o número pelo alvo de FPS', () => {
    expect(frameColor(59, 60)).toBe('bad');
    expect(frameColor(60, 60)).toBe('good');
    expect(frameColor(144, 60)).toBe('good');
  });

  it('rejeita binário com hash divergente', async () => {
    await expect(
      ensurePresentMon({
        existsSync: () => false,
        fetchFn: fakeFetch(new ArrayBuffer(8)),
        createHash: fakeHash('errado'),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        renameSync: vi.fn(),
      })
    ).resolves.toMatchObject({ error: expect.stringMatching(/integridade|hash/i) });
  });

  it('usa o binário em cache quando o hash confere', async () => {
    const writeFileSync = vi.fn();
    await expect(
      ensurePresentMon({
        existsSync: () => true,
        readFileSync: () => Buffer.from('binario'),
        createHash: fakeHash(PRESENTMON_SHA256),
        writeFileSync,
      })
    ).resolves.toMatchObject({ path: expect.stringContaining('PresentMon-2.3.1-x64.exe') });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('aceita o download quando o hash confere', async () => {
    await expect(
      ensurePresentMon({
        existsSync: () => false,
        fetchFn: fakeFetch(new ArrayBuffer(16)),
        createHash: fakeHash(PRESENTMON_SHA256),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        renameSync: vi.fn(),
      })
    ).resolves.toMatchObject({ path: expect.stringContaining('PresentMon-2.3.1-x64.exe') });
  });

  it('lê o CSV do stdout e devolve função de parada', () => {
    const stdout = new EventEmitter();
    const child = {
      stdout,
      stderr: new EventEmitter(),
      kill: vi.fn(),
      on: vi.fn(),
    };
    const spawn = vi.fn(() => child);
    const onMs = vi.fn();

    const stop = startCapture('cs2.exe', onMs, { spawn: spawn as never, binaryPath: 'C:\\pm.exe' });
    stdout.emit('data', Buffer.from('Application,MsBetweenPresents\ncs2.exe,10\ncs2.exe,12\n'));
    expect(onMs).toHaveBeenNthCalledWith(1, 10);
    expect(onMs).toHaveBeenNthCalledWith(2, 12);
    stop();
    expect(child.kill).toHaveBeenCalled();
  });
});
