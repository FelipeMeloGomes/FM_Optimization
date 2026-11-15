import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fiacao real: `startRun` termina, a janela pode ja ter sido fechada (o
 * `close` agora destroi), e o unico aviso possivel e a notificacao nativa.
 * Mockar tudo menos o executor e a forma de provar esse caminho sem abrir o
 * Electron de verdade.
 */

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  spawn: vi.fn(),
  execSync: vi.fn(),
  isSupported: vi.fn(() => true),
  show: vi.fn(),
  created: [] as { title: string; body: string; silent: boolean }[],
  window: {
    destroyed: false,
    isDestroyed: () => mocks.window.destroyed,
    webContents: { send: vi.fn() },
  },
  windows: [] as unknown[],
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => (mocks.window.destroyed ? null : mocks.window),
    getAllWindows: () => mocks.windows,
  },
  Notification: class {
    static isSupported = mocks.isSupported;
    constructor(options: { title: string; body: string; silent: boolean }) {
      mocks.created.push(options);
    }
    show = mocks.show;
  },
}));

vi.mock('node:child_process', () => ({ spawn: mocks.spawn, execSync: mocks.execSync }));
vi.mock('../audit-logger', () => ({
  auditAdminCheck: vi.fn(),
  auditScriptExecution: vi.fn(),
}));
vi.mock('../path-validation', () => ({ validateScriptPath: () => ({ valid: true }) }));
vi.mock('../services/admin-check', () => ({ isAdmin: () => true }));
vi.mock('../services/data-service', () => ({
  loadSettings: () => ({ autoRestorePoint: false }),
  addHistoryEntry: vi.fn(),
  updateHistoryEntry: vi.fn(),
}));
vi.mock('../services/script-registry', () => ({
  extractScriptToTemp: () => 'C:\\Temp\\tweak.bat',
  getScriptById: () => ({
    id: 'tweak-1',
    name: 'Desativar telemetria',
    extension: 'bat',
    requiresAdmin: false,
  }),
}));

const { cancelExecution, executeScript, runScriptSilently } = await import(
  '../services/script-executor'
);

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  pid = 4242;
  unref = vi.fn();
  kill = vi.fn();
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function startAndClose(code: number | null, destroyWindowFirst = true): Promise<void> {
  const child = new FakeChild();
  mocks.spawn.mockReturnValueOnce(child);
  executeScript('tweak-1');

  if (destroyWindowFirst) {
    mocks.window.destroyed = true;
    mocks.windows.length = 0;
  }

  child.emit('close', code);
  await flush();
}

describe('notificacao de fim de script com a janela fechada', () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.spawn.mockReset();
    mocks.execSync.mockReset();
    mocks.isSupported.mockReset().mockReturnValue(true);
    mocks.show.mockReset();
    mocks.created.length = 0;
    mocks.window.destroyed = false;
    mocks.window.webContents.send = mocks.send;
    mocks.windows.length = 0;
    mocks.windows.push(mocks.window);
  });

  it('notifica o sucesso quando a janela foi fechada durante a execucao', async () => {
    await startAndClose(0);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.created).toEqual([
      { title: 'Script concluído', body: 'Desativar telemetria', silent: false },
    ]);
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('notifica a falha com o codigo de saida', async () => {
    await startAndClose(3);

    expect(mocks.created).toEqual([
      { title: 'Script falhou', body: 'Desativar telemetria (código 3)', silent: false },
    ]);
  });

  it('nao notifica quando a janela ainda esta viva e recebe o evento', async () => {
    await startAndClose(0, false);

    expect(mocks.send).toHaveBeenCalledWith('script-ended', expect.stringContaining('tweak-1'));
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it('distingue cancelamento de falha', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValueOnce(child);
    executeScript('tweak-1');

    cancelExecution('tweak-1');
    expect(mocks.execSync).toHaveBeenCalledWith(
      expect.stringContaining('taskkill'),
      expect.anything()
    );

    mocks.window.destroyed = true;
    mocks.windows.length = 0;
    child.emit('close', 1);
    await flush();

    expect(mocks.created).toEqual([
      { title: 'Script cancelado', body: 'Desativar telemetria', silent: false },
    ]);
  });

  it('nao duplica o anuncio da limpeza agendada', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValueOnce(child);
    const completion = runScriptSilently('tweak-1');

    mocks.windows.length = 0;
    child.emit('close', 0);
    await expect(completion).resolves.toEqual({ code: 0, cancelled: false });

    expect(mocks.show).not.toHaveBeenCalled();
  });
});
