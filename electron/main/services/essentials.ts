import { type ChildProcess, spawn } from 'node:child_process';
import { BrowserWindow, shell } from 'electron';
import {
  ESSENTIAL_PROGRAMS,
  type EssentialProgram,
  getEssentialProgram,
} from '../../shared/essentials';
import type {
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
} from '../../shared/ipc-types';
import {
  detectWingetPhase,
  isWingetAlreadyInstalled,
  isWingetSuccess,
  parseWingetProgress,
  wingetErrorMessage,
} from './essentials-winget';

const PROGRESS_INTERVAL_MS = 120;
const MAX_WINGET_OUTPUT = 16_000;

interface RunningInstall {
  child: ChildProcess;
  cancelled: boolean;
}

const installs = new Map<string, RunningInstall>();

function requireProgram(id: string): EssentialProgram {
  const program = getEssentialProgram(id);
  if (!program) throw new Error('Programa não encontrado.');
  return program;
}

function broadcastInstallProgress(progress: EssentialInstallProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('essential-install-progress', progress);
  }
}

/** Catalogo puro: nada de rede aqui, a pagina abre mesmo sem internet. */
export function listEssentials(): EssentialListItem[] {
  return ESSENTIAL_PROGRAMS.map((program) => ({
    id: program.id,
    name: program.name,
    description: program.description,
    pageUrl: program.pageUrl,
    packageId: program.packageId,
    warning: program.warning,
  }));
}

/**
 * Instala pelo winget, que baixa do canal oficial do fornecedor e confere o
 * hash do manifesto antes de rodar o instalador. O progresso sai do proprio
 * stdout do winget (reescrito com `\r`), entao a UI recebe percentual e fase.
 */
export function installEssential(id: string): Promise<EssentialInstallResult> {
  const program = requireProgram(id);

  if (installs.has(id)) {
    throw new Error(`${program.name} já está sendo instalado.`);
  }

  const { packageId } = program;

  return new Promise<EssentialInstallResult>((resolve, reject) => {
    const child = spawn(
      'winget',
      [
        'install',
        '--id',
        packageId,
        '--exact',
        '--source',
        'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
      ],
      { windowsHide: true }
    );

    const entry: RunningInstall = { child, cancelled: false };
    installs.set(id, entry);

    let output = '';
    let lastEmit = 0;
    let lastPhase: 'downloading' | 'installing' | null = null;
    let settled = false;

    const finish = (settler: () => void) => {
      if (settled) return;
      settled = true;
      installs.delete(id);
      settler();
    };

    const onChunk = (chunk: string) => {
      output = `${output}${chunk}`.slice(-MAX_WINGET_OUTPUT);

      const phase = detectWingetPhase(output);
      const phaseChanged = phase !== null && phase !== lastPhase;
      if (phase) lastPhase = phase;

      const now = Date.now();
      if (!phaseChanged && now - lastEmit < PROGRESS_INTERVAL_MS) return;
      lastEmit = now;

      const progress = parseWingetProgress(output);
      if (progress) {
        broadcastInstallProgress({
          id,
          status: phase === 'installing' ? 'installing' : 'downloading',
          percent: progress.percent,
        });
        return;
      }

      if (phase) broadcastInstallProgress({ id, status: phase, percent: null });
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);

    child.on('error', () => {
      finish(() => reject(new Error(wingetErrorMessage(null, output))));
    });

    child.on('close', (code) => {
      finish(() => {
        const installed = isWingetSuccess(output);

        if (entry.cancelled && !installed) {
          reject(new Error('Instalação cancelada.'));
          return;
        }

        if (installed || code === 0 || isWingetAlreadyInstalled(output)) {
          resolve({ id, alreadyInstalled: isWingetAlreadyInstalled(output) && !installed });
          return;
        }

        reject(new Error(wingetErrorMessage(code, output)));
      });
    });
  });
}

export function cancelEssentialInstall(id: string): void {
  const entry = installs.get(id);
  if (!entry) return;

  entry.cancelled = true;
  const { pid } = entry.child;
  if (!pid) {
    entry.child.kill();
    return;
  }

  // Mata a arvore: o instalador disparado pelo winget nao pode seguir sozinho.
  spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () =>
    entry.child.kill()
  );
}

export async function openEssentialPage(id: string): Promise<void> {
  await shell.openExternal(requireProgram(id).pageUrl);
}
