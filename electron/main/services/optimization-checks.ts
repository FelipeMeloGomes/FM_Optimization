import type { ScriptEntry } from '../../shared/ipc-types';

export type RegistryValueType =
  | 'REG_DWORD'
  | 'REG_SZ'
  | 'REG_BINARY'
  | 'REG_EXPAND_SZ'
  | 'REG_QWORD';

export interface RegistryCheck {
  kind: 'registry';
  key: string;
  value: string;
  type: RegistryValueType;
  expected: string;
}

export type PowerSetting = 'standby-ac' | 'standby-dc' | 'cpmincores' | 'aspm';

export interface PowerCheck {
  kind: 'power';
  setting: PowerSetting;
  expected: string;
}

export interface TcpCheck {
  kind: 'tcp';
  setting: string;
  expected: string;
}

export type OptimizationCheck = RegistryCheck | PowerCheck | TcpCheck;

/** Consultas usadas pelo leitor real para cada ajuste de energia do plano. */
export const POWER_QUERIES: Record<PowerSetting, { args: string[]; field: 'ac' | 'dc' }> = {
  'standby-ac': {
    args: ['/q', 'SCHEME_CURRENT', 'SUB_SLEEP', 'STANDBYIDLE'],
    field: 'ac',
  },
  'standby-dc': {
    args: ['/q', 'SCHEME_CURRENT', 'SUB_SLEEP', 'STANDBYIDLE'],
    field: 'dc',
  },
  cpmincores: {
    args: ['/q', 'SCHEME_CURRENT', 'SUB_PROCESSOR', 'CPMINCORES'],
    field: 'ac',
  },
  aspm: { args: ['/q', 'SCHEME_CURRENT', 'SUB_PCIEXPRESS', 'ASPM'], field: 'ac' },
};

/** Rótulos do `netsh int tcp show global` para cada opção de `set global`. */
export const TCP_LABELS: Record<string, string> = {
  autotuninglevel: 'Receive Window Auto-Tuning Level',
  chimney: 'Chimney Offload State',
  congestionprovider: 'Add-On Congestion Control Provider',
  ecncapability: 'ECN Capability',
  timestamps: 'RFC 1323 Timestamps',
  rss: 'Receive-Side Scaling State',
  rsc: 'Receive Segment Coalescing State',
  dca: 'Direct Cache Acess (DCA)',
  qmgrlimit: 'QoM Limit',
};

const HIVE_ALIASES: Record<string, string> = {
  HKEY_LOCAL_MACHINE: 'HKLM',
  HKEY_CURRENT_USER: 'HKCU',
  HKEY_USERS: 'HKU',
  HKEY_CLASSES_ROOT: 'HKCR',
  HKLM: 'HKLM',
  HKCU: 'HKCU',
  HKU: 'HKU',
  HKCR: 'HKCR',
};

export function decodeScript(script: ScriptEntry): string {
  return Buffer.from(script.content, 'base64').toString('utf-8');
}

export function normalizeKey(raw: string): string {
  const trimmed = raw.trim().replace(/^"(.*)"$/, '$1');
  const separator = trimmed.indexOf('\\');
  const hive = (separator === -1 ? trimmed : trimmed.slice(0, separator)).toUpperCase();
  const rest = separator === -1 ? '' : trimmed.slice(separator);
  return `${HIVE_ALIASES[hive] ?? hive}${rest}`;
}

export function normalizeValue(type: RegistryValueType, raw: string): string {
  const trimmed = raw.trim().replace(/^"((?:[^"\\]|\\.)*)"$/, '$1');

  if (type === 'REG_DWORD' || type === 'REG_QWORD') {
    const hex = /^0x([0-9a-f]+)$/i.exec(trimmed);
    if (hex) return BigInt(`0x${hex[1]}`).toString(10);
    if (/^\d+$/.test(trimmed)) return BigInt(trimmed).toString(10);
    if (/^[0-9a-f]+$/i.test(trimmed)) return BigInt(`0x${trimmed}`).toString(10);
    return trimmed.toLowerCase();
  }

  if (type === 'REG_BINARY') {
    return trimmed
      .replace(/^hex:/i, '')
      .replace(/[\\,\s]/g, '')
      .toUpperCase();
  }

  return trimmed.toLowerCase();
}

export function checkId(check: OptimizationCheck): string {
  switch (check.kind) {
    case 'registry':
      return `registry:${check.key}|${check.value}`.toLowerCase();
    case 'power':
      return `power:${check.setting}`;
    case 'tcp':
      return `tcp:${check.setting}`;
  }
}

/** Junta as linhas continuadas de valores `hex:` de arquivos .reg. */
function joinContinuations(lines: string[]): string[] {
  const result: string[] = [];
  let pending = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (pending) {
      pending += trimmed.replace(/\\$/, '');
      if (!trimmed.endsWith('\\')) {
        result.push(pending);
        pending = '';
      }
      continue;
    }
    if (trimmed.endsWith('\\')) {
      pending = trimmed.slice(0, -1);
    } else {
      result.push(trimmed);
    }
  }

  if (pending) result.push(pending);
  return result;
}

function parseRegFile(content: string, checks: Map<string, OptimizationCheck>): void {
  let key = '';
  for (const line of joinContinuations(content.split(/\r?\n/))) {
    const keyMatch = /^\[(HKEY_[^\]]+)\]$/i.exec(line);
    if (keyMatch) {
      key = normalizeKey(keyMatch[1]);
      continue;
    }
    if (!key) continue;

    const valueMatch = /^"((?:[^"\\]|\\.)*)"\s*=\s*(.*)$/.exec(line);
    if (!valueMatch) continue;

    const value = valueMatch[1];
    const raw = valueMatch[2].trim();
    let type: RegistryValueType;
    let expected: string;

    if (/^dword:/i.test(raw)) {
      type = 'REG_DWORD';
      expected = raw.slice(6);
    } else if (/^hex(?:\([0-9]+\))?:/i.test(raw)) {
      type = 'REG_BINARY';
      expected = raw.slice(raw.indexOf(':') + 1);
    } else {
      type = 'REG_SZ';
      expected = raw;
    }

    const check: RegistryCheck = {
      kind: 'registry',
      key,
      value: value.toLowerCase(),
      type,
      expected: normalizeValue(type, expected),
    };
    checks.set(checkId(check), check);
  }
}

function parseBat(content: string, checks: Map<string, OptimizationCheck>): void {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    const regAdd = /^reg(?:\.exe)?\s+add\s+"([^"]+)"(.*)$/i.exec(line);
    if (regAdd) {
      const tail = regAdd[2];
      const name = /\/v\s+(?:"([^"]*)"|(\S+))/i.exec(tail);
      const type = /\/t\s+(\S+)/i.exec(tail);
      const data = /\/d\s+(?:"((?:[^"\\]|\\.)*)"|(\S+))/i.exec(tail);
      const valueName = (name?.[1] ?? name?.[2] ?? '').toLowerCase();
      const valueType = (type?.[1] ?? 'REG_SZ').toUpperCase() as RegistryValueType;
      const rawValue = data?.[1] ?? data?.[2] ?? '';

      const check: RegistryCheck = {
        kind: 'registry',
        key: normalizeKey(regAdd[1]),
        value: valueName,
        type: valueType,
        expected: normalizeValue(valueType, rawValue),
      };
      checks.set(checkId(check), check);
      continue;
    }

    if (/^powercfg(?:\.exe)?\s+[-/]h\s+off\b/i.test(line)) {
      const hibernate: RegistryCheck = {
        kind: 'registry',
        key: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power',
        value: 'hibernateenabled',
        type: 'REG_DWORD',
        expected: '0',
      };
      checks.set(checkId(hibernate), hibernate);
      continue;
    }

    const standby =
      /^powercfg(?:\.exe)?\s+(?:[-/]change\s+)?[-/]standby-timeout-(ac|dc)\s+(\d+)/i.exec(line);
    if (standby) {
      const setting = `standby-${standby[1]}` as PowerSetting;
      const check: PowerCheck = { kind: 'power', setting, expected: standby[2] };
      checks.set(checkId(check), check);
      continue;
    }

    const acValue =
      /^powercfg(?:\.exe)?\s+[-/]setacvalueindex\s+SCHEME_CURRENT\s+(\S+)\s+(\S+)\s+(\d+)/i.exec(
        line
      );
    if (acValue) {
      const setting = acValue[2].toLowerCase() === 'cpmincores' ? 'cpmincores' : 'aspm';
      const check: PowerCheck = { kind: 'power', setting, expected: acValue[3] };
      checks.set(checkId(check), check);
      continue;
    }

    const netsh =
      /^netsh(?:\.exe)?\s+(?:int|interface)\s+tcp\s+set\s+global\s+([a-z0-9_-]+)\s*=\s*(\S+)/i.exec(
        line
      );
    if (netsh) {
      const setting = netsh[1].toLowerCase() === 'ecn' ? 'ecncapability' : netsh[1].toLowerCase();
      const expected = netsh[2]
        .toLowerCase()
        .replace(/^enable$/, 'enabled')
        .replace(/^disable$/, 'disabled');
      const check: TcpCheck = { kind: 'tcp', setting, expected };
      checks.set(checkId(check), check);
    }
  }
}

/**
 * Deriva as verificações do próprio conteúdo do script. Assim a nota não
 * depende de um mapa manual que possa sair de sincronia com o catálogo.
 */
export function parseChecks(script: ScriptEntry): OptimizationCheck[] {
  const checks = new Map<string, OptimizationCheck>();
  const content = decodeScript(script);

  if (script.extension === 'reg') parseRegFile(content, checks);
  else parseBat(content, checks);

  return [...checks.values()];
}
