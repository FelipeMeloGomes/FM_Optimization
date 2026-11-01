import type { StartupAppEntry, StartupAppSource } from '../../shared/ipc-types';
import { psLiteral } from './ps-literal';
import { isStartupApprovedEnabled, startupApprovedHex } from './startup-approved';

const SOURCES: ReadonlySet<StartupAppSource> = new Set([
  'registry-user',
  'registry-machine',
  'registry-user-32',
  'registry-machine-32',
  'folder-user',
  'folder-machine',
]);

const STARTUP_FILE = /\.(lnk|url|exe|bat|cmd|ps1|vbs)$/i;

function isSource(value: unknown): value is StartupAppSource {
  return typeof value === 'string' && SOURCES.has(value as StartupAppSource);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function startupAppId(source: StartupAppSource, name: string): string {
  return `app:${source}:${name}`;
}

export function parseStartupAppId(id: string): { source: StartupAppSource; name: string } | null {
  if (!id.startsWith('app:')) return null;
  const rest = id.slice(4);
  const separator = rest.indexOf(':');
  if (separator <= 0) return null;
  const source = rest.slice(0, separator);
  const name = rest.slice(separator + 1);
  if (!isSource(source) || name.length === 0) return null;
  return { source, name };
}

export function startupAppRequiresAdmin(source: StartupAppSource): boolean {
  return (
    source === 'registry-machine' || source === 'registry-machine-32' || source === 'folder-machine'
  );
}

/** Caminho do valor `StartupApproved` que o Gerenciador de Tarefas usa. */
export function startupApprovedTarget(source: StartupAppSource): { key: string } {
  const base = '\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved';
  switch (source) {
    case 'registry-machine-32':
      return { key: `HKLM:${base}\\Run32` };
    case 'registry-machine':
      return { key: `HKLM:${base}\\Run` };
    case 'folder-machine':
      return { key: `HKLM:${base}\\StartupFolder` };
    case 'folder-user':
      return { key: `HKCU:${base}\\StartupFolder` };
    case 'registry-user-32':
      return { key: `HKCU:${base}\\Run32` };
    case 'registry-user':
      return { key: `HKCU:${base}\\Run` };
  }
}

/**
 * Extrai o executável de um comando de Run key. Só devolve caminho absoluto:
 * `rundll32.exe foo.dll` não tem pasta para abrir no Explorer.
 */
export function parseExecutablePath(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  let candidate: string;
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end <= 1) return null;
    candidate = trimmed.slice(1, end);
  } else {
    const first = trimmed.split(/\s+/)[0];
    if (!first) return null;
    candidate = first;
  }

  return /^[a-zA-Z]:\\/.test(candidate) ? candidate : null;
}

export function parseRunEntries(json: string): StartupAppEntry[] {
  const entries: StartupAppEntry[] = [];

  for (const item of asList(safeParse(json))) {
    if (!isRecord(item)) continue;
    const source = item.source;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const command = typeof item.command === 'string' ? item.command : '';
    if (!isSource(source) || !name) continue;

    const approved = typeof item.approved === 'string' ? item.approved : null;
    entries.push({
      id: startupAppId(source, name),
      name,
      command,
      source,
      enabled: isStartupApprovedEnabled(approved),
      requiresAdmin: startupAppRequiresAdmin(source),
      location: parseExecutablePath(command),
    });
  }

  return entries;
}

export interface RegistryPayload {
  entries: StartupAppEntry[];
  folderApproved: {
    user: Record<string, string>;
    machine: Record<string, string>;
  };
}

function approvedMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const map: Record<string, string> = {};
  for (const [name, approved] of Object.entries(value)) {
    if (typeof approved === 'string' && approved) map[name] = approved;
  }
  return map;
}

/**
 * O script de listagem devolve um único JSON com as entradas das Run keys e os
 * blobs `StartupApproved` das pastas de inicialização. As pastas em si são
 * lidas do disco pelo processo principal, não pelo PowerShell.
 */
export function parseRegistryPayload(json: string): RegistryPayload {
  const parsed = safeParse(json);
  if (!isRecord(parsed)) {
    return { entries: [], folderApproved: { user: {}, machine: {} } };
  }

  const folder = isRecord(parsed.folderApproved) ? parsed.folderApproved : {};

  return {
    entries: parseRunEntries(JSON.stringify(parsed.entries ?? [])),
    folderApproved: {
      user: approvedMap(folder.user),
      machine: approvedMap(folder.machine),
    },
  };
}

export function parseStartupFolderEntries(
  files: string[],
  approved: Record<string, string>,
  source: 'folder-user' | 'folder-machine',
  dir: string
): StartupAppEntry[] {
  const base = dir.replace(/[\\/]+$/, '');

  return files
    .filter((file) => STARTUP_FILE.test(file))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((file) => {
      const fullPath = `${base}\\${file}`;
      return {
        id: startupAppId(source, file),
        name: file,
        command: fullPath,
        source,
        enabled: isStartupApprovedEnabled(approved[file]),
        requiresAdmin: startupAppRequiresAdmin(source),
        location: fullPath,
      };
    });
}

export function buildStartupAppToggleScript(entry: StartupAppEntry, enabled: boolean): string {
  const target = startupApprovedTarget(entry.source);
  const name = psLiteral(entry.name);

  if (enabled) {
    // Remover o override é o que o Gerenciador de Tarefas faz para reativar:
    // sem valor, o Windows volta a tratar a entrada como ativa.
    return `Remove-ItemProperty -Path ${psLiteral(target.key)} -Name ${name} -Force -ErrorAction SilentlyContinue`;
  }

  const bytes =
    startupApprovedHex(false)
      .match(/.{2}/g)
      ?.map((byte) => `0x${byte}`)
      .join(',') ?? '';

  // Perfis novos podem não ter a chave StartupApproved; criá-la é inofensivo e
  // evita que o primeiro "desativar" falhe.
  return `New-Item -Path ${psLiteral(target.key)} -Force | Out-Null\nSet-ItemProperty -Path ${psLiteral(target.key)} -Name ${name} -Value ([byte[]](${bytes})) -Type Binary -Force -ErrorAction Stop`;
}
