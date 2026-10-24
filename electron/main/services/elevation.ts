import { spawn } from 'node:child_process';
import type { ElevatedLaunchResult } from '../../shared/ipc-types';

/** Código nativo devolvido pelo ShellExecuteEx quando o usuário cancela o UAC. */
export const UAC_CANCELLED_CODE = 1223;

const LAUNCH_TIMEOUT_MS = 120_000;

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Escapa um argumento no formato que o CommandLineToArgvW (usado por qualquer
 * executável Win32) desmonta: aspas delimitam, `\` só escapa quando precede `"`.
 * Sem isso o JSON de `--elevate-dns` chegaria sem as aspas e caminhos com
 * espaço seriam partidos em vários argumentos.
 */
export function quoteWindowsArg(value: string): string {
  if (value.length > 0 && !/[\s"]/.test(value)) return value;

  let quoted = '"';
  let backslashes = 0;
  for (const char of value) {
    if (char === '\\') {
      backslashes += 1;
      continue;
    }
    if (char === '"') {
      // As barras antes da aspa precisam ser dobradas e a aspa escapada.
      quoted += `${'\\'.repeat(backslashes * 2 + 1)}"`;
      backslashes = 0;
      continue;
    }
    quoted += '\\'.repeat(backslashes) + char;
    backslashes = 0;
  }
  // Barras no fim viram `\` duplicado para não escaparem a aspa de fechamento.
  return `${quoted}${'\\'.repeat(backslashes * 2)}"`;
}

/**
 * Monta o script PowerShell que dispara o processo elevado. O `exit` do *nosso*
 * PowerShell é o único sinal confiável do resultado: `Start-Process` não propaga
 * `$LASTEXITCODE` do filho e `-Wait` criaria deadlock com o single-instance lock
 * (o filho espera a instância atual sair).
 *
 * `-ArgumentList` recebe **uma** string já citada: com um array o PowerShell
 * apenas junta os itens com espaço, sem escapar nada.
 */
export function buildElevationCommand(exePath: string, args: string[]): string {
  const argList =
    args.length > 0 ? ` -ArgumentList ${psQuote(args.map(quoteWindowsArg).join(' '))}` : '';
  return [
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  Start-Process -FilePath ${psQuote(exePath)}${argList} -Verb RunAs -ErrorAction Stop`,
    '  exit 0',
    '} catch {',
    '  $code = 1',
    '  $inner = $_.Exception',
    '  while ($null -ne $inner) {',
    '    if ($inner -is [System.ComponentModel.Win32Exception]) { $code = $inner.NativeErrorCode; break }',
    '    $inner = $inner.InnerException',
    '  }',
    `  if ($code -eq ${UAC_CANCELLED_CODE}) { exit ${UAC_CANCELLED_CODE} } else { exit 1 }`,
    '}',
  ].join('\n');
}

export function mapElevationExit(code: number | null, stderr: string): ElevatedLaunchResult {
  if (code === 0) return { launched: true, cancelled: false };
  if (code === UAC_CANCELLED_CODE) return { launched: false, cancelled: true };
  return {
    launched: false,
    cancelled: false,
    error:
      stderr.trim() || `Falha ao iniciar como administrador (código ${code ?? 'desconhecido'})`,
  };
}

/**
 * Relança o app elevado. Só resolve `launched: true` quando o ShellExecuteEx
 * confirmou que o processo subiu — o chamador decide se encerra a instância atual.
 */
export function relaunchElevated(
  args: string[],
  exePath: string = process.execPath
): Promise<ElevatedLaunchResult> {
  const command = buildElevationCommand(exePath, args);

  return new Promise((resolve) => {
    let stderr = '';
    let settled = false;
    const finish = (result: ElevatedLaunchResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        /* já encerrado */
      }
      finish({
        launched: false,
        cancelled: false,
        error: 'Tempo esgotado esperando a resposta do Windows (UAC).',
      });
    }, LAUNCH_TIMEOUT_MS);

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      finish({ launched: false, cancelled: false, error: err.message });
    });

    proc.on('close', (code) => {
      finish(mapElevationExit(code, stderr));
    });
  });
}
