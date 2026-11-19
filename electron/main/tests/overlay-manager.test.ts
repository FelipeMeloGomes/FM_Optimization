import { describe, expect, it, vi } from 'vitest';
import type {
  OverlayFrame,
  OverlayGame,
  OverlaySettings,
  OverlayStatus,
} from '../../shared/overlay-types';
import { DEFAULT_OVERLAY_SETTINGS } from '../../shared/overlay-types';
import { createOverlayManager } from '../services/overlay-manager';
import type { RunningProcess } from '../services/overlay-processes';

const cs2: OverlayGame = {
  id: 'cs2',
  name: 'Counter-Strike 2',
  exePath: 'C:\\Jogos\\CS2\\cs2.exe',
  processName: 'cs2.exe',
  coverFile: null,
  enabled: true,
};
const valorant: OverlayGame = { ...cs2, id: 'val', processName: 'VALORANT.exe' };

function makeManager(overrides: Record<string, unknown> = {}) {
  const publishedStatus: OverlayStatus[] = [];
  const publishedFrames: OverlayFrame[] = [];
  const onMsRef: { current: ((ms: number) => void) | null } = { current: null };
  const stopCapture = vi.fn();
  const startCapture = vi.fn((_name: string, onMs: (ms: number) => void) => {
    onMsRef.current = onMs;
    return stopCapture;
  });
  const showOverlay = vi.fn();
  const hideOverlay = vi.fn();

  const deps = {
    getGames: () => [cs2],
    getSettings: () => DEFAULT_OVERLAY_SETTINGS,
    listRunningProcesses: async () => [] as RunningProcess[],
    getForegroundPid: async () => null as number | null,
    ensurePresentMon: async () => ({ path: 'C:\\pm.exe' }) as { path: string } | { error: string },
    startCapture,
    publishFrame: (frame: OverlayFrame) => publishedFrames.push(frame),
    publishStatus: (status: OverlayStatus) => publishedStatus.push(status),
    showOverlay,
    hideOverlay,
    applySettings: vi.fn(() => true),
    ...overrides,
  };

  return {
    manager: createOverlayManager(deps),
    onMsRef,
    publishedStatus,
    publishedFrames,
    startCapture,
    stopCapture,
    showOverlay,
    hideOverlay,
  };
}

describe('overlay-manager', () => {
  it('inicia a captura quando o jogo abre e a encerra quando fecha', async () => {
    const { manager, startCapture, stopCapture, publishedStatus } = makeManager();
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    manager.setForegroundPid(10);
    await manager.tick();

    expect(startCapture).toHaveBeenCalledWith('cs2.exe', expect.any(Function));
    expect(manager.getStatus()).toMatchObject({ capture: 'capturing', activeGameId: 'cs2' });

    manager.setRunningProcesses([]);
    await manager.tick();
    expect(stopCapture).toHaveBeenCalled();
    expect(manager.getStatus().capture).toBe('idle');
    expect(publishedStatus.length).toBeGreaterThan(1);
  });

  it('publica erro de privilégio sem deixar exceção solta', async () => {
    const { manager, startCapture, publishedStatus } = makeManager({
      ensurePresentMon: async () => ({ error: 'PresentMon exige privilégio de administrador.' }),
    });
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    await expect(manager.tick()).resolves.toBeUndefined();
    expect(startCapture).not.toHaveBeenCalled();
    expect(manager.getStatus()).toMatchObject({
      capture: 'error',
      message: 'PresentMon exige privilégio de administrador.',
    });
    expect(publishedStatus.at(-1)?.capture).toBe('error');
  });

  it('esconde o overlay quando o jogo perde o foco e a opção está ligada', async () => {
    const { manager, showOverlay, hideOverlay } = makeManager();
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    manager.setForegroundPid(999);
    await manager.tick();
    expect(hideOverlay).toHaveBeenCalled();

    manager.setForegroundPid(10);
    await manager.tick();
    expect(showOverlay).toHaveBeenCalled();
  });

  it('mantém o overlay visível após alt-tab quando a opção está desligada', async () => {
    const settings: OverlaySettings = { ...DEFAULT_OVERLAY_SETTINGS, onlyWhenFocused: false };
    const { manager, showOverlay, hideOverlay } = makeManager({ getSettings: () => settings });
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    manager.setForegroundPid(999);
    await manager.tick();
    expect(showOverlay).toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
  });

  it('captura só o jogo ativo e marca os demais como rodando', async () => {
    const { manager } = makeManager({ getGames: () => [cs2, valorant] });
    manager.setRunningProcesses([
      { processName: 'cs2.exe', pid: 10 },
      { processName: 'VALORANT.exe', pid: 30 },
    ]);
    manager.setForegroundPid(30);
    await manager.tick();
    expect(manager.getStatus()).toMatchObject({
      activeGameId: 'val',
      runningGameIds: ['cs2', 'val'],
    });
  });

  it('não consulta processos do Windows sem jogos habilitados', async () => {
    const listRunningProcesses = vi.fn(async () => [] as RunningProcess[]);
    const getForegroundPid = vi.fn(async () => null);
    const { manager } = makeManager({
      getGames: () => [{ ...cs2, enabled: false }],
      listRunningProcesses,
      getForegroundPid,
    });

    await manager.poll();
    expect(listRunningProcesses).not.toHaveBeenCalled();
    expect(getForegroundPid).not.toHaveBeenCalled();
    expect(manager.getStatus().capture).toBe('idle');
  });

  it('avisa quando o atalho global está ocupado', async () => {
    const { manager, publishedStatus } = makeManager({ applySettings: vi.fn(() => false) });
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    manager.setForegroundPid(10);
    await manager.tick();

    expect(publishedStatus.at(-1)?.warning).toMatch(/já está em uso/);
  });

  it('publica FPS suavizado com a cor do alvo', async () => {
    const { manager, onMsRef, publishedFrames } = makeManager();
    manager.setRunningProcesses([{ processName: 'cs2.exe', pid: 10 }]);
    manager.setForegroundPid(10);
    await manager.tick();

    const onMs = onMsRef.current;
    expect(onMs).toBeTypeOf('function');
    for (let i = 0; i < 60; i += 1) onMs?.(10);
    await manager.tick();
    expect(publishedFrames.at(-1)).toMatchObject({ fps: 100, color: 'good', visible: true });

    for (let i = 0; i < 60; i += 1) onMs?.(25);
    await manager.tick();
    expect(publishedFrames.at(-1)).toMatchObject({ fps: 40, color: 'bad' });
  });
});
