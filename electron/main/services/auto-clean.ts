import { BrowserWindow } from 'electron';
import type { AutoCleanRunResult, AutoCleanStatus } from '../../shared/ipc-types';
import { AutoCleanScheduler } from './auto-clean-scheduler';

let scheduler: AutoCleanScheduler | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

/**
 * Instância única do agendador. Criada sob demanda para que `ipc-handlers`
 * possa usá-la sem depender do ciclo de boot da janela.
 */
export function getAutoCleanScheduler(): AutoCleanScheduler {
  if (!scheduler) {
    scheduler = new AutoCleanScheduler(
      (status: AutoCleanStatus) => broadcast('auto-clean-status', status),
      (result: AutoCleanRunResult) => broadcast('auto-clean-finished', result)
    );
  }
  return scheduler;
}
