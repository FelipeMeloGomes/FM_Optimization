import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { BrowserWindow } from 'electron';
import type { ScriptEnded, ScriptEntry } from '../../shared/ipc-types';
import { auditAdminCheck, auditScriptExecution } from '../audit-logger';
import { validateScriptPath } from '../path-validation';
import { isAdmin } from './admin-check';
import { addHistoryEntry, loadSettings, updateHistoryEntry } from './data-service';
import { buildInteractiveLaunch, type InteractiveExtension } from './script-commands';
import { createHistoryEntry, normalizeInteractiveExitCode } from './script-outcome';
import { extractScriptToTemp, getScriptById } from './script-registry';

const activeProcesses = new Map<string, ChildProcess>();
/** Execuções canceladas pelo usuário; o `close` usa isso para marcar a entrada. */
const cancelledRuns = new Set<string>();

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

function isInteractiveExtension(ext: ScriptExtension | undefined): ext is InteractiveExtension {
  return ext === 'bat' || ext === 'cmd' || ext === 'ps1';
}

/**
 * Núcleo compartilhado entre a execução manual (com janela) e a agendada
 * (silenciosa). A validação de admin e de caminho vale para as duas.
 *
 * Interativos deixaram de ser "abriu e esqueceu": a janela roda dentro de um
 * wrapper oculto que espera o script terminar e devolve o exit code real. A
 * entrada do histórico é gravada na abertura (`exitCode: null`) e atualizada no
 * fechamento, então o botão só é liberado quando o desfecho é conhecido.
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

  const interactive = script?.interactive === true && isInteractiveExtension(ext);
  const startTime = Date.now();
  const scriptName = script?.name || id;
  const historyId = `${id}_${startTime}`;

  let proc: ChildProcess;
  if (interactive) {
    const launch = buildInteractiveLaunch(ext, filePath);
    proc = spawn(launch.command, launch.args, {
      windowsHide: true,
      // O wrapper fica oculto; o `Start-Process` lá dentro abre a janela visível
      // do script. Sem detached: com ele a janela do filho não aparece.
      stdio: 'ignore',
      env: { ...process.env, ...launch.env },
    });
  } else {
    const { command, args } = getCommand(ext, filePath);
    proc = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Sem isso os pipes enchem e o processo filho trava esperando alguém ler.
    proc.stdout?.on('data', () => {});
    proc.stderr?.on('data', () => {});
  }

  activeProcesses.set(id, proc);

  if (interactive) {
    addHistoryEntry(
      createHistoryEntry(id, scriptName, startTime, startTime, null, false, options.trigger)
    );
  }

  const completion = new Promise<ScriptRunCompletion>((resolve) => {
    let settled = false;

    const finish = (code: number | null, cancelled: boolean) => {
      if (settled) return;
      settled = true;

      activeProcesses.delete(id);
      notifyEnded({ id, code, scriptName, trigger: options.trigger }, options.win);

      const endTime = Date.now();
      if (interactive) {
        updateHistoryEntry(historyId, {
          endTime: new Date(endTime).toISOString(),
          durationMs: endTime - startTime,
          exitCode: code,
          wasCancelled: cancelled,
        });
      } else {
        addHistoryEntry(
          createHistoryEntry(id, scriptName, startTime, endTime, code, cancelled, options.trigger)
        );
      }

      auditScriptExecution(
        id,
        scriptName,
        script?.requiresAdmin ?? false,
        script?.requiresAdmin ? isAdmin() : true,
        code,
        code === 0
      );

      resolve({ code, cancelled });
    };

    proc.on('close', (rawCode) => {
      const cancelled = cancelledRuns.delete(id);
      const code = cancelled
        ? null
        : interactive
          ? normalizeInteractiveExitCode(id, rawCode)
          : rawCode;
      finish(code, cancelled);
    });

    proc.on('error', () => {
      cancelledRuns.delete(id);
      finish(-1, false);
    });
  });

  return { status: interactive ? 'opened' : 'started', completion };
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
  if (!proc?.pid) return;

  cancelledRuns.add(id);
  try {
    // `/T` mata a árvore: o wrapper oculto e o script que ele abriu.
    execSync(`taskkill /F /T /PID ${proc.pid}`, { timeout: 5000, stdio: 'ignore' });
  } catch {
    /* já morreu */
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
