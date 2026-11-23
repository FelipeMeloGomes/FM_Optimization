import { beforeAll, describe, expect, it, vi } from 'vitest';

type OptimizationBridge = {
  analyzeOptimization(): Promise<unknown>;
  applyOptimization(): Promise<unknown>;
  cancelOptimization(): Promise<void>;
  setOptimizationSimulation(enabled: boolean): Promise<void>;
  onOptimizationProgress(cb: (progress: unknown) => void): () => void;
};

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  exposed: null as unknown,
  invoke: vi.fn(async () => ({ success: true, data: undefined })),
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
    removeListener: vi.fn(),
  },
}));

beforeAll(async () => {
  await import('../electron/preload/index');
});

function api(): OptimizationBridge {
  return mocks.exposed as OptimizationBridge;
}

describe('bridge de otimização', () => {
  it('expõe análise, aplicação, cancelamento, simulação e progresso no electronAPI', () => {
    expect(typeof api().analyzeOptimization).toBe('function');
    expect(typeof api().applyOptimization).toBe('function');
    expect(typeof api().cancelOptimization).toBe('function');
    expect(typeof api().setOptimizationSimulation).toBe('function');
    expect(typeof api().onOptimizationProgress).toBe('function');
  });

  it('chama os canais corretos no invoke', async () => {
    await api().analyzeOptimization();
    await api().applyOptimization();
    await api().cancelOptimization();
    await api().setOptimizationSimulation(true);

    expect(mocks.invoke).toHaveBeenCalledWith('analyze-optimization');
    expect(mocks.invoke).toHaveBeenCalledWith('apply-optimization');
    expect(mocks.invoke).toHaveBeenCalledWith('cancel-optimization');
    expect(mocks.invoke).toHaveBeenCalledWith('set-optimization-simulation', true);
  });

  it('repassa o progresso e permite cancelar a inscrição', () => {
    const callback = vi.fn();
    const unsubscribe = api().onOptimizationProgress(callback);
    const payload = { current: 1, total: 2, id: 'tweaks-1', name: 'Tweak', status: 'running' };

    mocks.listeners.get('optimization-progress')?.({}, payload);
    expect(callback).toHaveBeenCalledWith(payload);

    unsubscribe();
    mocks.listeners.get('optimization-progress')?.({}, payload);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
