import { spawn } from 'node:child_process';
import { DRIVE_LETTER_PATTERN } from '../../shared/drive-actions';
import { isAdmin } from './admin-check';
import { INTERACTIVE_WRAPPER_COMMAND } from './script-commands';

export type DriveActionKind = 'cleanup' | 'optimize';

export { DRIVE_LETTER_PATTERN } from '../../shared/drive-actions';

const ADMIN_ERROR =
  'Este script requer privilégios de administrador. Execute o programa como administrador.';

export interface DriveActionLaunch {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Monta a abertura interativa por unidade. O caminho do comando vai por
 * variável de ambiente para não depender de escaping na linha do PowerShell,
 * seguindo o mesmo wrapper usado pelos scripts interativos.
 */
export function buildDriveActionCommand(
  kind: DriveActionKind,
  letter: string
): DriveActionLaunch {
  if (!DRIVE_LETTER_PATTERN.test(letter)) {
    throw new Error('Unidade inválida');
  }

  const drive = letter.toUpperCase();
  const childArgs =
    kind === 'cleanup' ? `/c cleanmgr /d ${drive}:` : `/c defrag ${drive}: /O /L`;

  return {
    command: 'powershell.exe',
    args: ['-NoProfile', '-Command', INTERACTIVE_WRAPPER_COMMAND],
    env: {
      FMOPT_CHILD_EXE: 'cmd.exe',
      FMOPT_CHILD_ARGS: childArgs,
    },
  };
}

/**
 * Abre a janela do Windows para a unidade e só resolve quando ela fecha —
 * `cleanmgr` é interativo e `defrag` pode demorar, então um timeout mataria a
 * operação antes do usuário terminar.
 */
export async function runDriveAction(
  kind: DriveActionKind,
  letter: string
): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error(ADMIN_ERROR);
  }

  const { command, args, env } = buildDriveActionCommand(kind, letter);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: 'ignore',
      env: { ...process.env, ...env },
    });

    child.once('error', reject);
    child.once('close', () => resolve());
  });
}
