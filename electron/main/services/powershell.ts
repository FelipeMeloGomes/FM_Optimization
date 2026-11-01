import { spawn } from 'node:child_process';

const DANGEROUS_PATTERNS = [
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bdel\s+\/f\s+\/s\s+\/q\s+[cC]:/i,
  /\brmdir\s+\/s\s+\/q\s+[cC]:/i,
  /reg\s+delete\s+HKLM\\/i,
  /reg\s+delete\s+HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/i,
  /Start-Process\s+-Verb\s+runas/i,
  /\brunas\s+/i,
  /\belevate\b/i,
  /Invoke-Expression\b/i,
  /\biex\b/i,
  /Invoke-WebRequest\s+-OutFile/i,
  /\bwget\s+/i,
  /curl\s+-o/i,
  /downloadstring/i,
  /Net\.WebClient/i,
  /System\.Net\.Http/i,
  /sc\s+stop\s+(wuauserv|wscsvc|windefend|mpssvc)/i,
  /Stop-Service\s+(wuauserv|wscsvc|windefend|mpssvc)/i,
  /\bbcdedit\b/i,
  /\bbootrec\b/i,
  /Remove-Item\s+-Recurse\s+-Force\s+[cC]:/i,
  /schtasks\s+\/delete\s+\/tn\s+.*\s+\/f/i,
  /Unregister-ScheduledTask\b/i,
  /wevtutil\s+cl\b/i,
  /Clear-EventLog\b/i,
  /vssadmin\s+delete\s+shadows/i,
  /wbadmin\s+delete\s+systemstatebackup/i,
  /cipher\s+\/w\s+[cC]:/i,
  /sdelete\b/i,
  /attrib\s+\+h\s+\+s\s+\+r\s+[cC]:/i,
  /takeown\s+\/f\s+[cC]:/i,
  /icacls\s+[cC]:\s+\/grant\s+.*\(F\)/i,
  /reg\s+add\s+HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run/i,
  /reg\s+add\s+HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run/i,
  /New-ItemProperty\s+-Path\s+HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run/i,
  /New-ItemProperty\s+-Path\s+HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run/i,
];

function cleanPsOutput(raw: string): string {
  return raw
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('#< CLIXML') && !line.startsWith('<Objs') && !line.startsWith('</Objs>')
    )
    .join('\n')
    .trim();
}

function sanitizeScript(script: string): { clean: string; violations: string[] } {
  const violations: string[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(script)) {
      violations.push(`Matched pattern: ${pattern.source}`);
    }
  }

  return { clean: script, violations };
}

export function psEscape(arg: string): string {
  return arg.replace(/['"`$;()|&<>]/g, (m) => `\`${m}`);
}

export function buildPsCommand(command: string, ...args: string[]): string[] {
  return [command, ...args.map(psEscape)];
}

export async function execPowerShell(script: string, timeout = 30000): Promise<string> {
  const { violations } = sanitizeScript(script);

  if (violations.length > 0) {
    throw new Error(`Script rejected by security policy: ${violations.join(', ')}`);
  }

  const wrapped = `$ProgressPreference = 'SilentlyContinue'\n${script}`;

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', wrapped],
      {
        timeout,
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn PowerShell: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
      } else {
        resolve(cleanPsOutput(stdout));
      }
    });
  });
}

export async function execPowerShellSafe(
  command: string,
  args: string[],
  options?: { timeout?: number }
): Promise<string> {
  const fullCommand = [command, ...args].join(' ');
  const { violations } = sanitizeScript(fullCommand);

  if (violations.length > 0) {
    throw new Error(`Command rejected by security policy: ${violations.join(', ')}`);
  }

  const timeout = options?.timeout ?? 30000;

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', fullCommand],
      { timeout }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn PowerShell: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
      } else {
        resolve(cleanPsOutput(stdout));
      }
    });
  });
}
