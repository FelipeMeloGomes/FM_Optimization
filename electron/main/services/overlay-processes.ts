import type { OverlayGame } from '../../shared/overlay-types';
import { execPowerShellSafe } from './powershell';

export interface RunningProcess {
  processName: string;
  pid: number;
}

type ExecPowerShell = (
  command: string,
  args: string[],
  options?: { timeout?: number }
) => Promise<string>;

interface ProcessDeps {
  execPowerShellSafe?: ExecPowerShell;
}

const FOREGROUND_SCRIPT = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OverlayFgWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  public static uint GetPid() {
    uint pid;
    GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    return pid;
  }
}
'@; [OverlayFgWin32]::GetPid()`;

/** Converte a saída `pid<TAB>nome` do PowerShell em processos. */
export function parseProcessList(output: string): RunningProcess[] {
  const processes: RunningProcess[] = [];
  for (const line of output.split(/\r?\n/)) {
    const [pidText, name] = line.trim().split('\t');
    if (!pidText || !name) continue;
    const pid = Number(pidText);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    processes.push({ pid, processName: name.trim() });
  }
  return processes;
}

/** Extrai o PID da janela em foco; 0/vazio significa nenhuma janela. */
export function parseForegroundPid(output: string): number | null {
  const pid = Number(output.trim().split(/\r?\n/)[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/**
 * Escolhe o jogo cuja captura deve estar ativa. Considera apenas jogos
 * habilitados e rodando; com `onlyWhenFocused`, o jogo em foco tem prioridade,
 * mas qualquer habilitado rodando serve como fallback.
 */
export function selectActiveGame(
  games: OverlayGame[],
  running: RunningProcess[],
  foregroundPid: number | null,
  onlyWhenFocused: boolean
): OverlayGame | null {
  const isRunning = (game: OverlayGame): boolean =>
    running.some((p) => p.processName.toLowerCase() === game.processName.toLowerCase());

  const candidates = games.filter((game) => game.enabled && isRunning(game));
  if (candidates.length === 0) return null;

  if (onlyWhenFocused && foregroundPid !== null) {
    const focused = candidates.find((game) =>
      running.some(
        (p) =>
          p.pid === foregroundPid && p.processName.toLowerCase() === game.processName.toLowerCase()
      )
    );
    if (focused) return focused;
  }

  return candidates[0];
}

export async function listRunningProcesses(deps: ProcessDeps = {}): Promise<RunningProcess[]> {
  const exec = deps.execPowerShellSafe ?? execPowerShellSafe;
  try {
    const output = await exec('Get-CimInstance', [
      'Win32_Process',
      '|',
      'ForEach-Object',
      '{',
      '"$($_.ProcessId)`t$($_.Name)"',
      '}',
    ]);
    return parseProcessList(output);
  } catch {
    return [];
  }
}

export async function getForegroundPid(deps: ProcessDeps = {}): Promise<number | null> {
  const exec = deps.execPowerShellSafe ?? execPowerShellSafe;
  try {
    return parseForegroundPid(await exec(FOREGROUND_SCRIPT, []));
  } catch {
    return null;
  }
}
