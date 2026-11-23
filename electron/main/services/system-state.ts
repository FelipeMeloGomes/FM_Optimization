import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  checkId,
  normalizeValue,
  POWER_QUERIES,
  type PowerCheck,
  type PowerSetting,
  type RegistryCheck,
  TCP_LABELS,
  type TcpCheck,
} from './optimization-checks';

const execFileAsync = promisify(execFile);

export type ExecFileFn = (
  file: string,
  args: string[],
  options?: { windowsHide?: boolean; encoding?: string; maxBuffer?: number }
) => Promise<{ stdout: string; stderr: string }>;

export interface SystemStateReader {
  readRegistry(checks: RegistryCheck[]): Promise<Map<string, string | null>>;
  readTcp(): Promise<string | null>;
  readPower(settings: PowerSetting[]): Promise<Map<PowerSetting, string | null>>;
}

export function parseRegistryQuery(output: string, key: string): Map<string, string | null> {
  const values = new Map<string, string | null>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(.+?\S)\s{2,}(REG_[A-Z_]+)\s{2,}(.*)$/.exec(line);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const type = match[2] as RegistryCheck['type'];
    values.set(name, normalizeValue(type, match[3]));
  }
  // A chave pode existir sem o valor procurado; isso é diferente de não conseguir ler.
  if (!values.size) values.set(`__key__:${key}`, null);
  return values;
}

export function parseTcpGlobal(output: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const label = line.slice(0, separator).trim().toLowerCase();
    const value = line
      .slice(separator + 1)
      .trim()
      .toLowerCase()
      .replace(/^enable$/, 'enabled')
      .replace(/^disable$/, 'disabled');
    if (label) values.set(label, value);
  }
  return values;
}

export function parsePowerQuery(output: string): Map<'ac' | 'dc', string | null> {
  const values = new Map<'ac' | 'dc', string | null>();
  for (const line of output.split(/\r?\n/)) {
    const match = /Current (AC|DC) Power Setting Index:\s*(0x[0-9a-f]+)/i.exec(line);
    if (!match) continue;
    values.set(match[1].toLowerCase() as 'ac' | 'dc', normalizeValue('REG_DWORD', match[2]));
  }
  return values;
}

export function createSystemStateReader(
  exec: ExecFileFn = execFileAsync as ExecFileFn
): SystemStateReader {
  return {
    async readRegistry(checks) {
      const byKey = new Map<string, RegistryCheck[]>();
      for (const check of checks) {
        const group = byKey.get(check.key) ?? [];
        group.push(check);
        byKey.set(check.key, group);
      }

      const results = new Map<string, string | null>();
      for (const [key, group] of byKey) {
        try {
          const { stdout } = await exec('reg.exe', ['query', key], {
            windowsHide: true,
            encoding: 'utf8',
            maxBuffer: 4 * 1024 * 1024,
          });
          const found = parseRegistryQuery(stdout, key);
          for (const check of group) {
            results.set(checkId(check), found.get(check.value) ?? null);
          }
        } catch {
          for (const check of group) results.set(checkId(check), null);
        }
      }
      return results;
    },

    async readTcp() {
      try {
        const { stdout } = await exec('netsh.exe', ['int', 'tcp', 'show', 'global'], {
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        });
        const parsed = parseTcpGlobal(stdout);
        const result = new Map<string, string>();
        for (const [setting, label] of Object.entries(TCP_LABELS)) {
          const value = parsed.get(label.toLowerCase());
          if (value !== undefined) result.set(setting, value);
        }
        return JSON.stringify(Object.fromEntries(result));
      } catch {
        return null;
      }
    },

    async readPower(settings) {
      const result = new Map<PowerSetting, string | null>();
      const queries = new Map<string, PowerSetting[]>();
      for (const setting of settings) {
        const args = POWER_QUERIES[setting].args.join(' ');
        const group = queries.get(args) ?? [];
        group.push(setting);
        queries.set(args, group);
      }

      for (const [args, group] of queries) {
        try {
          const { stdout } = await exec('powercfg.exe', args.split(' '), {
            windowsHide: true,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
          });
          const parsed = parsePowerQuery(stdout);
          for (const setting of group) {
            const field = POWER_QUERIES[setting].field;
            result.set(setting, parsed.get(field) ?? null);
          }
        } catch {
          for (const setting of group) result.set(setting, null);
        }
      }
      return result;
    },
  };
}

export function registryCheckValue(
  check: RegistryCheck,
  reader: Map<string, string | null>
): string | null {
  return reader.get(checkId(check)) ?? null;
}

export function tcpCheckValue(check: TcpCheck, raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[check.setting] ?? null;
  } catch {
    return null;
  }
}

export function powerCheckValue(
  check: PowerCheck,
  values: Map<PowerSetting, string | null>
): string | null {
  return values.get(check.setting) ?? null;
}
