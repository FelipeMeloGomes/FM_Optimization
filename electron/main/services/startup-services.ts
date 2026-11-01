import type { ServiceStartMode, StartupServiceEntry } from '../../shared/ipc-types';
import { psDoubleQuoted, psLiteral } from './ps-literal';

/**
 * Serviços que desligam um recurso essencial (RPC, energia, segurança, rede).
 * A UI mostra "Protegido" e não deixa alternar. A lista é conservadora de
 * propósito: o custo de bloquear um serviço que o usuário queria desligar é
 * baixo; o de deixar desligar o RPC é o Windows não iniciar.
 */
export const PROTECTED_SERVICES: ReadonlySet<string> = new Set([
  'RpcSs',
  'RpcEptMapper',
  'DcomLaunch',
  'PlugPlay',
  'Power',
  'ProfSvc',
  'EventLog',
  'Schedule',
  'SamSs',
  'WinDefend',
  'wuauserv',
  'wscsvc',
  'mpssvc',
  'CryptSvc',
  'Dnscache',
  'Dhcp',
  'nsi',
  'netprofm',
  'NlaSvc',
  'LanmanServer',
  'LanmanWorkstation',
  'Themes',
  'UserManager',
  'gpsvc',
  'SENS',
  'Audiosrv',
  'AudioEndpointBuilder',
]);

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

function toStartMode(raw: unknown, delayed: boolean): ServiceStartMode {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (value === 'auto' || value === 'automatic') {
    return delayed ? 'AutomaticDelayed' : 'Automatic';
  }
  if (value === 'manual') return 'Manual';
  if (value === 'disabled') return 'Disabled';
  return 'Unknown';
}

function toState(raw: unknown): StartupServiceEntry['state'] {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (value === 'running') return 'Running';
  if (value === 'stopped') return 'Stopped';
  if (value === 'paused') return 'Paused';
  return 'Unknown';
}

export function isProtectedService(name: string): boolean {
  return PROTECTED_SERVICES.has(name);
}

export function serviceId(name: string): string {
  return `service:${name}`;
}

export function parseServiceId(id: string): string | null {
  if (!id.startsWith('service:')) return null;
  const name = id.slice(8);
  return name.length > 0 ? name : null;
}

/**
 * Só interessam serviços que iniciam com o Windows (Automático/Automático
 * atrasado) e os que foram desativados — estes últimos precisam continuar na
 * lista para o usuário poder reativar. Manuais ficam de fora: são centenas e
 * não fazem parte da inicialização.
 */
export function parseServices(json: string): StartupServiceEntry[] {
  const entries: StartupServiceEntry[] = [];

  for (const item of asList(safeParse(json))) {
    if (!isRecord(item)) continue;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) continue;

    const startMode = toStartMode(item.startMode, item.delayed === true);
    if (startMode !== 'Automatic' && startMode !== 'AutomaticDelayed' && startMode !== 'Disabled') {
      continue;
    }

    entries.push({
      id: serviceId(name),
      name,
      displayName:
        typeof item.displayName === 'string' && item.displayName ? item.displayName : name,
      startMode,
      state: toState(item.state),
      protected: isProtectedService(name),
      requiresAdmin: true,
    });
  }

  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

export function buildServiceToggleScript(
  service: StartupServiceEntry,
  enabled: boolean,
  original: ServiceStartMode | null
): string {
  if (!enabled) {
    return `Set-Service -Name ${psLiteral(service.name)} -StartupType Disabled -ErrorAction Stop`;
  }

  if (original === 'AutomaticDelayed') {
    // Set-Service do Windows PowerShell 5.1 não expõe o início atrasado.
    return `sc.exe config ${psDoubleQuoted(service.name)} start= delayed-auto`;
  }

  return `Set-Service -Name ${psLiteral(service.name)} -StartupType Automatic -ErrorAction Stop`;
}

export function buildStopServiceScript(name: string): string {
  return `Stop-Service -Name ${psLiteral(name)} -Force -ErrorAction Stop`;
}
