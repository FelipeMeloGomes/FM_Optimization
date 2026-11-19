import { app, BrowserWindow } from 'electron';
import type { OverlayFrame, OverlayStatus } from '../../shared/overlay-types';
import { appState } from '../app-state';
import {
  applyOverlaySettings,
  createOverlayWindow,
  hideOverlayWindow,
  showOverlayWindow,
  updateOverlayFrame,
} from '../overlay-window';
import { relaunchElevated } from './elevation';
import { createOverlayManager, type OverlayManager } from './overlay-manager';
import { getForegroundPid, listRunningProcesses } from './overlay-processes';
import { getOverlayGames, getOverlaySettings } from './overlay-storage';
import { ensurePresentMon, startCapture } from './presentmon';

let manager: OverlayManager | null = null;
const statusCallbacks = new Set<(status: OverlayStatus) => void>();

function getManager(): OverlayManager {
  if (!manager) {
    manager = createOverlayManager({
      getGames: getOverlayGames,
      getSettings: getOverlaySettings,
      listRunningProcesses,
      getForegroundPid,
      ensurePresentMon,
      startCapture,
      publishFrame: (frame: OverlayFrame) => {
        createOverlayWindow();
        updateOverlayFrame(frame);
      },
      publishStatus: (status) => {
        for (const cb of statusCallbacks) cb(status);
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('overlay:status', status);
        }
      },
      showOverlay: () => {
        createOverlayWindow();
        showOverlayWindow();
      },
      hideOverlay: hideOverlayWindow,
      applySettings: applyOverlaySettings,
    });
  }
  return manager;
}

export function startOverlayMonitor(): void {
  applyOverlaySettings(getOverlaySettings());
  getManager().start();
}

export function stopOverlayMonitor(): void {
  getManager().stop();
}

export function getOverlayStatus(): OverlayStatus {
  return getManager().getStatus();
}

export function onOverlayStatus(cb: (status: OverlayStatus) => void): () => void {
  statusCallbacks.add(cb);
  return () => {
    statusCallbacks.delete(cb);
  };
}

export function hasEnabledOverlayGames(): boolean {
  return getOverlayGames().some((game) => game.enabled);
}

export function refreshOverlayConfig(): void {
  applyOverlaySettings(getOverlaySettings());
}

/** Relança o app elevado reaproveitando o handover já usado pelo elevate-app. */
export async function restartOverlayElevated(): Promise<void> {
  const args = process.argv
    .slice(1)
    .filter(
      (arg) =>
        !arg.startsWith('--elevate-') &&
        !arg.startsWith('--wait-pid') &&
        arg !== '--hidden' &&
        arg !== '--overlay-elevated'
    );
  args.push('--overlay-elevated', `--wait-pid=${process.pid}`);

  const result = await relaunchElevated(args);
  if (!result.launched) {
    throw new Error('Não foi possível relançar o FM Optimize como administrador.');
  }
  appState.isQuitting = true;
  stopOverlayMonitor();
  app.quit();
}
