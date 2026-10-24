import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { BrowserWindow } from 'electron';
import type { ExecutionHistoryEntry, ScriptEnded, ScriptEntry } from '../../shared/ipc-types';
import { auditAdminCheck, auditScriptExecution } from '../audit-logger';
import { validateScriptPath } from '../path-validation';
import { isAdmin } from './admin-check';
import { addHistoryEntry, loadSettings } from './data-service';
import { buildInteractiveWindowCommand } from './script-commands';
import { extractScriptToTemp, getScriptById } from './script-registry';

const activeProcesses = new Map<string, ChildProcess>();

interface ScriptRunCompletion {
  code: number | null;
  cancelled: boolean;
}

interface RunOptions {
  trigger: 'manual' | 'scheduled';
  /** Janela que recebe `script-ended`. Sem janela, o evento vai para todas. */
  win?: BrowserWindow | null;
  /** Ponto de restauração é caro; limpeza agendada não cria. */
  createRestorePoint?: boolean;
}

function notifyEnded(data: ScriptEnded, win?: BrowserWindow | null): void {
  const payload = JSON.stringify(data);
  if (win && !win.isDestroyed()) {
    win.webContents.send('script-ended', payload);
    return;
  }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('script-ended', payload);
  }
}

function createHistoryEntry(
  scriptId: string,
  scriptName: string,
  startTime: number,
  endTime: number,
  exitCode: number | null,
  wasCancelled: boolean,
  trigger: 'manual' | 'scheduled'
): ExecutionHistoryEntry {
  return {
    id: `${scriptId}_${startTime}`,
    scriptId,
    scriptName,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    exitCode,
    wasCancelled,
    trigger,
  };
}

/**
 * Núcleo compartilhado entre a execução manual (com janela) e a agendada
 * (silenciosa). A validação de admin e de caminho vale para as duas.
 */
function startRun(
  id: string,
  options: RunOptions
): { status: 'opened' | 'started'; completion: Promise<ScriptRunCompletion> } {
  if (activeProcesses.has(id)) {
    throw new Error(`Script "${id}" já está em execução`);
  }

  const script = getScriptById(id);
  const requiresAdmin = script?.requiresAdmin ?? false;
  const adminCheck = requiresAdmin ? isAdmin() : true;
  auditAdminCheck(adminCheck, `script:${id}`);
  if (requiresAdmin && !adminCheck) {
    throw new Error(
      'Este script requer privilégios de administrador. Execute o programa como administrador.'
    );
  }

  const filePath = extractScriptToTemp(id);

  const pathValidation = validateScriptPath(filePath);
  if (!pathValidation.valid) {
    throw new Error(`Path validation failed: ${pathValidation.error}`);
  }

  const ext = filePath.split('.').pop()?.toLowerCase() as ScriptExtension | undefined;

  if (options.createRestorePoint !== false && loadSettings().autoRestorePoint && script) {
    const safeName = script.name
      .replace(/[^a-zA-Z0-9 áéíóúàèìòùâêîôûãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ\s.:_-]/g, '')
      .trim();
    if (safeName) {
      spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Checkpoint-Computer -Description "Antes de executar: ${safeName}" -RestorePointType MODIFY_SETTINGS`,
        ],
        { stdio: 'ignore', detached: true }
      ).unref();
    }
  }

  if (script?.interactive && (ext === 'bat' || ext === 'cmd' || ext === 'ps1')) {
    const command = buildInteractiveWindowCommand(ext, filePath);
    const proc = spawn(command, {
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    proc.unref();
    notifyEnded({ id, code: 0, scriptName: script?.name, trigger: options.trigger }, options.win);
    const now = Date.now();
    addHistoryEntry(
      createHistoryEntry(id, script?.name || id, now, now, 0, false, options.trigger)
    );
    auditScriptExecution(id, script?.name || id, false, true, 0, true);
    return { status: 'opened', completion: Promise.resolve({ code: 0, cancelled: false }) };
  }

  const { command, args } = getCommand(ext, filePath);
  const proc = spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.set(id, proc);

  // Sem isso os pipes enchem e o processo filho trava esperando alguém ler.
  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  const startTime = Date.now();

  const completion = new Promise<ScriptRunCompletion>((resolve) => {
    proc.on('close', (code) => {
      activeProcesses.delete(id);
      notifyEnded({ id, code, scriptName: script?.name, trigger: options.trigger }, options.win);
      const endTime = Date.now();
      addHistoryEntry(
        createHistoryEntry(id, script?.name || id, startTime, endTime, code, false, options.trigger)
      );
      auditScriptExecution(
        id,
        script?.name || id,
        script?.requiresAdmin ?? false,
        script?.requiresAdmin ? isAdmin() : true,
        code,
        code === 0
      );
      resolve({ code, cancelled: false });
    });

    proc.on('error', (_err) => {
      activeProcesses.delete(id);
      notifyEnded(
        { id, code: -1, scriptName: script?.name, trigger: options.trigger },
        options.win
      );
      const endTime = Date.now();
      addHistoryEntry(
        createHistoryEntry(id, script?.name || id, startTime, endTime, -1, false, options.trigger)
      );
      auditScriptExecution(
        id,
        script?.name || id,
        script?.requiresAdmin ?? false,
        script?.requiresAdmin ? isAdmin() : true,
        -1,
        false
      );
      resolve({ code: -1, cancelled: false });
    });
  });

  return { status: 'started', completion };
}

export function executeScript(id: string): string {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) throw new Error('Nenhuma janela ativa');

  return startRun(id, { trigger: 'manual', win }).status;
}

/**
 * Caminho sem janela, usado pelo agendador. Aguarda o processo terminar para
 * que a fila de limpezas rode em série e o estado final seja conhecido.
 */
export function runScriptSilently(id: string): Promise<ScriptRunCompletion> {
  return startRun(id, {
    trigger: 'scheduled',
    win: null,
    createRestorePoint: false,
  }).completion;
}

export function cancelExecution(id: string): void {
  const proc = activeProcesses.get(id);
  if (proc?.pid) {
    try {
      proc.kill('SIGTERM');
    } catch {
      try {
        execSync(`taskkill /F /T /PID ${proc.pid}`, { timeout: 5000 });
      } catch {
        /* already dead */
      }
    }
    const script = getScriptById(id);
    const now = Date.now();
    addHistoryEntry(createHistoryEntry(id, script?.name || id, now, now, null, true, 'manual'));
    auditScriptExecution(id, script?.name || id, script?.requiresAdmin ?? false, true, null, false);
    activeProcesses.delete(id);
  }
}

type ScriptExtension = ScriptEntry['extension'];

function getCommand(
  ext: ScriptExtension | undefined,
  filePath: string
): { command: string; args: string[] } {
  if (ext === undefined) {
    return { command: 'cmd.exe', args: ['/c', filePath] };
  }
  switch (ext) {
    case 'bat':
    case 'cmd':
      return { command: 'cmd.exe', args: ['/c', filePath] };
    case 'ps1':
      return {
        command: 'powershell.exe',
        args: ['-ExecutionPolicy', 'Bypass', '-File', filePath],
      };
    case 'reg':
      return { command: 'regedit.exe', args: ['/s', filePath] };
    case 'exe':
      return { command: filePath, args: [] };
    default: {
      const _exhaustive: never = ext;
      return _exhaustive;
    }
  }
}
