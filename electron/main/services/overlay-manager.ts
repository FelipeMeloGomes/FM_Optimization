import type {
  OverlayFrame,
  OverlayGame,
  OverlaySettings,
  OverlayStatus,
} from '../../shared/overlay-types';
import { type RunningProcess, selectActiveGame } from './overlay-processes';
import {
  computeSmoothedFps,
  type ensurePresentMon,
  frameColor,
  type startCapture,
} from './presentmon';

type EnsureFn = typeof ensurePresentMon;
type StartCaptureFn = typeof startCapture;

export interface OverlayManagerDeps {
  getGames(): OverlayGame[];
  getSettings(): OverlaySettings;
  listRunningProcesses(): Promise<RunningProcess[]>;
  getForegroundPid(): Promise<number | null>;
  ensurePresentMon: EnsureFn;
  startCapture: StartCaptureFn;
  publishFrame(frame: OverlayFrame): void;
  publishStatus(status: OverlayStatus): void;
  showOverlay(): void;
  hideOverlay(): void;
  /** Devolve `false` quando o atalho global já está ocupado. */
  applySettings(settings: OverlaySettings): boolean;
  maxSamples?: number;
}

export interface OverlayManager {
  tick(): Promise<void>;
  poll(): Promise<void>;
  start(): void;
  stop(): void;
  getStatus(): OverlayStatus;
  setRunningProcesses(processes: RunningProcess[]): void;
  setForegroundPid(pid: number | null): void;
}

const IDLE_STATUS: OverlayStatus = {
  capture: 'idle',
  activeGameId: null,
  runningGameIds: [],
  message: null,
};

/** Orquestra detecção, captura e publicação de frames para o overlay. */
export function createOverlayManager(deps: OverlayManagerDeps): OverlayManager {
  const maxSamples = deps.maxSamples ?? 60;
  let status: OverlayStatus = { ...IDLE_STATUS };
  let running: RunningProcess[] = [];
  let foregroundPid: number | null = null;
  let stopCurrentCapture: (() => void) | null = null;
  let activeGameId: string | null = null;
  let samples: number[] = [];
  let interval: ReturnType<typeof setInterval> | null = null;

  function publish(patch: Partial<OverlayStatus>): void {
    status = { ...status, ...patch };
    deps.publishStatus(status);
  }

  function stopCapture(): void {
    stopCurrentCapture?.();
    stopCurrentCapture = null;
    activeGameId = null;
    samples = [];
  }

  function onFrameSample(ms: number): void {
    samples.push(ms);
    if (samples.length > maxSamples) samples.shift();
  }

  async function tick(): Promise<void> {
    const games = deps.getGames();
    const settings = deps.getSettings();
    const runningIds = games
      .filter((game) =>
        running.some((p) => p.processName.toLowerCase() === game.processName.toLowerCase())
      )
      .map((game) => game.id);

    const selected = selectActiveGame(games, running, foregroundPid, settings.onlyWhenFocused);
    if (!selected) {
      stopCapture();
      deps.hideOverlay();
      publish({
        capture: runningIds.length > 0 ? 'waiting' : 'idle',
        activeGameId: null,
        runningGameIds: runningIds,
        message: null,
      });
      return;
    }

    if (selected.id !== activeGameId) {
      stopCapture();
      const ensured = await deps.ensurePresentMon();
      if ('error' in ensured) {
        deps.hideOverlay();
        publish({
          capture: 'error',
          activeGameId: null,
          runningGameIds: runningIds,
          message: ensured.error,
        });
        return;
      }
      stopCurrentCapture = deps.startCapture(selected.processName, onFrameSample);
      activeGameId = selected.id;
    }

    const isFocused =
      foregroundPid !== null &&
      running.some(
        (p) =>
          p.pid === foregroundPid &&
          p.processName.toLowerCase() === selected.processName.toLowerCase()
      );
    const visible = !settings.onlyWhenFocused || isFocused;

    const hotkeyOk = deps.applySettings(settings);
    publish({
      warning: hotkeyOk
        ? null
        : `O atalho ${settings.hotkey} já está em uso por outro aplicativo. Escolha outro nas configurações.`,
    });

    if (visible) deps.showOverlay();
    else deps.hideOverlay();

    publish({
      capture: 'capturing',
      activeGameId: selected.id,
      runningGameIds: runningIds,
      message: null,
    });

    const fps = computeSmoothedFps(samples);
    if (fps !== null) {
      deps.publishFrame({ fps, color: frameColor(fps, settings.targetFps), visible });
      samples = [];
    }
  }

  async function poll(): Promise<void> {
    // Sem jogos habilitados não há nada a detectar: evita dois spawns do
    // PowerShell a cada segundo para usuários que nunca usam o overlay.
    if (!deps.getGames().some((game) => game.enabled)) {
      running = [];
      foregroundPid = null;
      await tick();
      return;
    }
    running = await deps.listRunningProcesses();
    foregroundPid = await deps.getForegroundPid();
    await tick();
  }

  return {
    tick,
    poll,
    start() {
      if (interval) return;
      void poll();
      interval = setInterval(() => {
        void poll();
      }, 1000);
    },
    stop() {
      if (interval) clearInterval(interval);
      interval = null;
      stopCapture();
    },
    getStatus() {
      return status;
    },
    setRunningProcesses(processes) {
      running = processes;
    },
    setForegroundPid(pid) {
      foregroundPid = pid;
    },
  };
}
