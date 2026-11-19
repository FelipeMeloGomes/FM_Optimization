import { beforeAll, describe, expect, it, vi } from 'vitest';

type OverlayMainBridge = {
  getOverlayGames(): Promise<unknown>;
  addOverlayGame(input: unknown): Promise<unknown>;
  removeOverlayGame(id: string): Promise<unknown>;
  setOverlayGameEnabled(input: unknown): Promise<unknown>;
  getOverlaySettings(): Promise<unknown>;
  saveOverlaySettings(input: unknown): Promise<unknown>;
  getOverlayStatus(): Promise<unknown>;
  getOverlayCover(fileName: string): Promise<unknown>;
  getGameDisplayMode(gameId: string): Promise<unknown>;
  setGameBorderless(gameId: string): Promise<unknown>;
  startOverlayMonitor(): Promise<unknown>;
  stopOverlayMonitor(): Promise<unknown>;
  restartOverlayElevated(): Promise<unknown>;
  chooseOverlayExe(): Promise<unknown>;
  launchOverlayGame(id: string): Promise<unknown>;
  onOverlayStatus(cb: (status: unknown) => void): () => void;
};

const mocks = vi.hoisted(() => ({
  exposed: null as unknown,
  invoke: vi.fn(async () => ({ success: true, data: null })),
  statusListener: null as ((event: unknown, data: unknown) => void) | null,
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_key: string, api: unknown) => {
      mocks.exposed = api;
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: (channel: string, cb: (event: unknown, data: unknown) => void) => {
      if (channel === 'overlay:status') mocks.statusListener = cb;
    },
    removeListener: vi.fn(),
  },
}));

beforeAll(async () => {
  await import('../electron/preload/index');
});

function api(): OverlayMainBridge {
  return mocks.exposed as OverlayMainBridge;
}

describe('bridge principal do overlay', () => {
  it.each([
    ['getOverlayGames', 'get-overlay-games'],
    ['getOverlaySettings', 'get-overlay-settings'],
    ['getOverlayStatus', 'get-overlay-status'],
    ['startOverlayMonitor', 'start-overlay-monitor'],
    ['stopOverlayMonitor', 'stop-overlay-monitor'],
    ['restartOverlayElevated', 'restart-overlay-elevated'],
    ['chooseOverlayExe', 'choose-overlay-exe'],
  ] as Array<[keyof OverlayMainBridge, string]>)('expõe %s no canal %s', async (method, channel) => {
    mocks.invoke.mockResolvedValueOnce({ success: true, data: null });
    await (api()[method] as () => Promise<unknown>)();
    expect(mocks.invoke).toHaveBeenCalledWith(channel);
  });

  it('busca a capa pelo nome do arquivo', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: true, data: 'data:image/jpeg;base64,Y2FwYQ==' });
    await expect(api().getOverlayCover('730.jpg')).resolves.toBe('data:image/jpeg;base64,Y2FwYQ==');
    expect(mocks.invoke).toHaveBeenCalledWith('get-overlay-cover', '730.jpg');
  });

  it('consulta e troca o modo de tela pelo id do jogo', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: true, data: { mode: 'exclusive' } });
    await expect(api().getGameDisplayMode('batman')).resolves.toEqual({ mode: 'exclusive' });
    expect(mocks.invoke).toHaveBeenCalledWith('get-game-display-mode', 'batman');

    mocks.invoke.mockResolvedValueOnce({ success: true, data: { mode: 'borderless' } });
    await expect(api().setGameBorderless('batman')).resolves.toEqual({ mode: 'borderless' });
    expect(mocks.invoke).toHaveBeenCalledWith('set-game-borderless', 'batman');
  });

  it('envia o payload aos canais com argumento', async () => {
    mocks.invoke.mockResolvedValue({ success: true, data: null });
    const input = { exePath: 'C:\\Jogos\\cs2.exe' };
    await api().addOverlayGame(input);
    expect(mocks.invoke).toHaveBeenCalledWith('add-overlay-game', input);

    await api().setOverlayGameEnabled({ id: 'cs2', enabled: false });
    expect(mocks.invoke).toHaveBeenCalledWith('set-overlay-game-enabled', {
      id: 'cs2',
      enabled: false,
    });

    mocks.invoke.mockResolvedValueOnce({ success: true, data: { id: 'cs2' } });
    await api().removeOverlayGame('cs2');
    expect(mocks.invoke).toHaveBeenCalledWith('remove-overlay-game', 'cs2');
  });

  it('inicia o jogo pelo id no canal de lançamento', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: true, data: null });

    await api().launchOverlayGame('cs2');

    expect(mocks.invoke).toHaveBeenCalledWith('launch-overlay-game', 'cs2');
  });

  it('rejeita quando o main process devolve erro', async () => {
    mocks.invoke.mockResolvedValueOnce({ success: false, error: 'sem permissão' });
    await expect(api().getOverlayStatus()).rejects.toBe('sem permissão');
  });

  it('repassa atualizações de status', () => {
    const cb = vi.fn();
    const unsubscribe = api().onOverlayStatus(cb);
    const status = { capture: 'capturing', activeGameId: 'cs2', runningGameIds: [], message: null };
    mocks.statusListener?.({}, status);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    mocks.statusListener?.({}, status);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
