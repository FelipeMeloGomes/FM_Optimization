import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * A bridge é a única ponte entre o renderer isolado e o main. Estes testes
 * verificam os canais e o repasse do progresso na implementação real do
 * preload, em vez de confiar em uma reescrita do contrato.
 */

type SpeedBridge = {
  measureSpeed(): Promise<unknown>;
  cancelSpeedTest(): Promise<void>;
  onSpeedProgress(callback: (progress: unknown) => void): () => void;
};

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  exposed: null as unknown,
  invoke: vi.fn(async () => ({ success: true, data: undefined })),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_key: string, api: unknown) => {
      mocks.exposed = api;
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      mocks.listeners.set(channel, callback);
    },
    removeListener: mocks.removeListener,
  },
}));

beforeAll(async () => {
  await import('../electron/preload/index');
});

function api(): SpeedBridge {
  return mocks.exposed as SpeedBridge;
}

describe('bridge de velocidade', () => {
  it('expõe measureSpeed, cancelSpeedTest e onSpeedProgress no electronAPI', () => {
    expect(typeof api().measureSpeed).toBe('function');
    expect(typeof api().cancelSpeedTest).toBe('function');
    expect(typeof api().onSpeedProgress).toBe('function');
  });

  it('repassa o progresso do canal speed-progress para o callback', () => {
    const callback = vi.fn();
    const unsubscribe = api().onSpeedProgress(callback);
    const payload = { phase: 'download', progress: 0.5, currentMbps: 42 };

    mocks.listeners.get('speed-progress')?.({}, payload);

    expect(callback).toHaveBeenCalledWith(payload);

    unsubscribe();
    mocks.listeners.get('speed-progress')?.({}, payload);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('chama os canais corretos no invoke', async () => {
    await api().measureSpeed();
    await api().cancelSpeedTest();

    expect(mocks.invoke).toHaveBeenCalledWith('measure-speed');
    expect(mocks.invoke).toHaveBeenCalledWith('cancel-speed-test');
  });
});
