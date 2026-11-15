import { type ChildProcess, spawn } from 'node:child_process';
import type { RestorePointEntry } from '../../shared/ipc-types';

function execPowerShell(script: string, timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(script, 'utf16le');
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-EncodedCommand', buf.toString('base64')],
      {
        timeout,
      }
    ) as ChildProcess;

    let stdout = '';
    let stderr = '';

    proc.stdout?.setEncoding('utf-8');
    proc.stderr?.setEncoding('utf-8');

    proc.stdout?.on('data', (data: string) => {
      stdout += data;
    });
    proc.stderr?.on('data', (data: string) => {
      stderr += data;
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn PowerShell: ${err.message}`));
    });

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const errMsg = stderr.trim() || `PowerShell exited with code ${code}`;
        reject(new Error(errMsg));
      }
    });
  });
}

const RESTORE_TYPES: Record<number, string> = {
  0: 'Application Install',
  1: 'Application Uninstall',
  10: 'Device Driver Install',
  12: 'Modify Settings',
  13: 'Cancelled Operation',
};

export async function getRestorePoints(): Promise<RestorePointEntry[]> {
  const script = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$points = Get-ComputerRestorePoint
foreach ($rp in $points) {
  $s = $rp.SequenceNumber.ToString()
  $d = $rp.Description
  $t = [System.Management.ManagementDateTimeConverter]::ToDateTime($rp.CreationTime).ToString("yyyy-MM-dd HH:mm:ss")
  $r = [int]$rp.RestorePointType
  Write-Output ("$s|||$d|||$r|||$t")
}
`;
  try {
    const output = await execPowerShell(script);
    if (!output) return [];

    const items: RestorePointEntry[] = [];
    for (const line of output.split('\n')) {
      const cols = line.split('|||');
      if (cols.length < 4) continue;
      const rpt = parseInt(cols[2], 10);
      items.push({
        sequenceNumber: parseInt(cols[0], 10),
        description: cols[1] || '',
        creationTime: cols[3] || '',
        eventType: RESTORE_TYPES[rpt] || 'Unknown',
      });
    }
    return items;
  } catch (e: unknown) {
    const err = e as { message?: string };
    throw new Error(err.message || String(e));
  }
}

export async function createRestorePoint(name: string): Promise<void> {
  const safeName = name
    .replace(/[^a-zA-Z0-9 áéíóúàèìòùâêîôûãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ\s.:_-]/g, '')
    .trim();
  if (!safeName) throw new Error('Nome do ponto de restauração inválido');
  await execPowerShell(
    `Checkpoint-Computer -Description "${safeName}" -RestorePointType MODIFY_SETTINGS`
  );
}

export async function deleteRestorePoint(seq: number): Promise<void> {
  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class SR {
  [DllImport("SrClient.dll", CharSet = CharSet.Unicode)]
  public static extern int SRRemoveRestorePoint(int dwRPNum);
}
'@
[SR]::SRRemoveRestorePoint(${seq})
`;
  await execPowerShell(script);
}

export async function restoreSystem(seq: number): Promise<void> {
  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq <= 0) {
    throw new Error('SequenceNumber inválido');
  }
  await execPowerShell(
    `Get-ComputerRestorePoint | Where-Object { $_.SequenceNumber -eq ${Math.floor(seq)} } | Restore-Computer -Confirm:$false -Force`
  );
}
