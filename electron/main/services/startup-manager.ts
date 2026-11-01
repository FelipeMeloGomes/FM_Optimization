import type {
  StartupAppEntry,
  StartupServiceEntry,
  StartupSetEnabledPayload,
  StartupSnapshot,
} from '../../shared/ipc-types';
import { buildScheduledTaskToggleScript, parseScheduledTasks } from './scheduled-tasks';
import {
  buildStartupAppToggleScript,
  parseRegistryPayload,
  parseStartupFolderEntries,
} from './startup-apps';
import { createStartupOverridesStore, type StartupOverridesStore } from './startup-overrides';
import {
  buildServiceToggleScript,
  buildStopServiceScript,
  parseServices,
} from './startup-services';

const LIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

# Propriedades que o provider de registro acrescenta a todo item. Filtrar por
# prefixo "PS" esconderia apps cujo nome começa com PS (ex.: "PS4 Remote Play").
$providerProps = @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider', 'PSComputerName')

function Read-ApprovedMap([string]$Path) {
  $map = @{}
  $props = Get-ItemProperty -Path $Path
  if ($props) {
    foreach ($prop in $props.PSObject.Properties) {
      if ($providerProps -contains $prop.Name) { continue }
      if ($prop.Value -is [byte[]]) {
        $map[$prop.Name] = [Convert]::ToBase64String($prop.Value)
      }
    }
  }
  return $map
}

function Read-RunKey([string]$Path, [string]$Source, $Approved) {
  $items = @()
  $props = Get-ItemProperty -Path $Path
  if ($props) {
    foreach ($prop in $props.PSObject.Properties) {
      if ($providerProps -contains $prop.Name) { continue }
      $approvedValue = $null
      if ($Approved.ContainsKey($prop.Name)) { $approvedValue = $Approved[$prop.Name] }
      $items += [pscustomobject]@{
        source = $Source
        name = $prop.Name
        command = [string]$prop.Value
        approved = $approvedValue
      }
    }
  }
  return $items
}

$approvedUser = Read-ApprovedMap 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
$approvedUser32 = Read-ApprovedMap 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'
$approvedMachine = Read-ApprovedMap 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
$approvedMachine32 = Read-ApprovedMap 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'

$entries = @()
$entries += Read-RunKey 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'registry-user' $approvedUser
$entries += Read-RunKey 'HKCU:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' 'registry-user-32' $approvedUser32
$entries += Read-RunKey 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'registry-machine' $approvedMachine
$entries += Read-RunKey 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' 'registry-machine-32' $approvedMachine32

$tasks = @()
foreach ($task in (Get-ScheduledTask)) {
  $trigger = $null
  $triggerNames = @($task.Triggers | ForEach-Object { $_.CimClass.CimClassName })
  if ($triggerNames -contains 'MSFT_TaskBootTrigger') {
    $trigger = 'boot'
  } elseif ($triggerNames -contains 'MSFT_TaskLogonTrigger') {
    $trigger = 'logon'
  }
  if (-not $trigger) { continue }

  $action = @($task.Actions | Where-Object { $_.Execute } | Select-Object -First 1)
  $actionText = ''
  if ($action.Count -gt 0) {
    $actionText = ("$($action[0].Execute) $($action[0].Arguments)").Trim()
  }

  $tasks += [pscustomobject]@{
    name = $task.TaskName
    path = $task.TaskPath
    state = [string]$task.State
    trigger = $trigger
    action = $actionText
    author = [string]$task.Author
  }
}

$services = @()
foreach ($service in (Get-CimInstance Win32_Service)) {
  if ($service.StartMode -ne 'Auto' -and $service.StartMode -ne 'Disabled') { continue }
  $delayed = $false
  $config = Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$($service.Name)"
  if ($config -and $config.DelayedAutostart -eq 1) { $delayed = $true }

  $services += [pscustomobject]@{
    name = $service.Name
    displayName = $service.DisplayName
    startMode = $service.StartMode
    state = $service.State
    delayed = $delayed
  }
}

$payload = [pscustomobject]@{
  entries = $entries
  folderApproved = [pscustomobject]@{
    user = Read-ApprovedMap 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'
    machine = Read-ApprovedMap 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'
  }
  tasks = @($tasks)
  services = @($services)
}

$payload | ConvertTo-Json -Depth 6 -Compress
`;

export interface StartupManagerDeps {
  exec(script: string): Promise<string>;
  isAdmin(): boolean;
  readDir(dir: string): string[];
  revealItem(path: string): void;
  dataDir: string;
  startupDirs: { user: string; machine: string };
}

export interface StartupManager {
  listStartup(): Promise<StartupSnapshot>;
  setStartupEnabled(payload: StartupSetEnabledPayload): Promise<StartupSnapshot>;
  openStartupLocation(id: string): Promise<void>;
  stopStartupService(id: string): Promise<StartupSnapshot>;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function notFound(): Error {
  return new Error('Entrada não encontrada. Recarregue a página e tente novamente.');
}

function needsAdmin(): Error {
  return new Error(
    'Esta entrada exige privilégios de administrador. Reinicie o FM Optimize como administrador.'
  );
}

/**
 * Orquestra as três listas (apps, tarefas e serviços) e valida cada alteração
 * contra o último snapshot. O renderer só manda `{ kind, id }`; o nome real e o
 * alvo do comando saem daqui, nunca do processo de interface.
 */
export function createStartupManager(deps: StartupManagerDeps): StartupManager {
  const overrides: StartupOverridesStore = createStartupOverridesStore(deps.dataDir);
  let snapshot: StartupSnapshot | null = null;

  async function buildSnapshot(): Promise<StartupSnapshot> {
    const raw = await deps.exec(LIST_SCRIPT);
    const payload = parseJsonObject(raw);
    const registry = parseRegistryPayload(raw);

    const folderUser = parseStartupFolderEntries(
      deps.readDir(deps.startupDirs.user),
      registry.folderApproved.user,
      'folder-user',
      deps.startupDirs.user
    );
    const folderMachine = parseStartupFolderEntries(
      deps.readDir(deps.startupDirs.machine),
      registry.folderApproved.machine,
      'folder-machine',
      deps.startupDirs.machine
    );

    const next: StartupSnapshot = {
      apps: [...registry.entries, ...folderUser, ...folderMachine],
      tasks: parseScheduledTasks(JSON.stringify(payload?.tasks ?? [])),
      services: parseServicesFromPayload(payload?.services),
      isAdmin: deps.isAdmin(),
    };

    snapshot = next;
    return next;
  }

  async function ensureSnapshot(): Promise<StartupSnapshot> {
    return snapshot ?? buildSnapshot();
  }

  function requireAdmin(entry: { requiresAdmin: boolean }): void {
    if (entry.requiresAdmin && !deps.isAdmin()) throw needsAdmin();
  }

  async function toggleApp(
    current: StartupSnapshot,
    payload: StartupSetEnabledPayload
  ): Promise<void> {
    const entry = current.apps.find((app) => app.id === payload.id);
    if (!entry) throw notFound();
    requireAdmin(entry);

    await deps.exec(buildStartupAppToggleScript(entry, payload.enabled));
    entry.enabled = payload.enabled;
  }

  async function toggleTask(
    current: StartupSnapshot,
    payload: StartupSetEnabledPayload
  ): Promise<void> {
    const task = current.tasks.find((item) => item.id === payload.id);
    if (!task) throw notFound();
    requireAdmin(task);

    await deps.exec(buildScheduledTaskToggleScript(task, payload.enabled));
    task.enabled = payload.enabled;
  }

  async function toggleService(
    current: StartupSnapshot,
    payload: StartupSetEnabledPayload
  ): Promise<void> {
    const service = current.services.find((item) => item.id === payload.id);
    if (!service) throw notFound();
    if (service.protected) {
      throw new Error('Serviço protegido: desativá-lo pode impedir o Windows de iniciar.');
    }
    requireAdmin(service);

    if (!payload.enabled) {
      // Guarda o tipo original antes de mexer, para a reativação ser fiel.
      if (service.startMode === 'Automatic' || service.startMode === 'AutomaticDelayed') {
        overrides.recordServiceStartMode(service.name, service.startMode);
      }
      await deps.exec(buildServiceToggleScript(service, false, null));
      service.startMode = 'Disabled';
      return;
    }

    const original = overrides.getServiceStartMode(service.name);
    await deps.exec(buildServiceToggleScript(service, true, original));
    overrides.clearServiceStartMode(service.name);
    service.startMode = original ?? 'Automatic';
  }

  return {
    listStartup() {
      return buildSnapshot();
    },

    async setStartupEnabled(payload) {
      const current = await ensureSnapshot();

      switch (payload.kind) {
        case 'app':
          await toggleApp(current, payload);
          break;
        case 'task':
          await toggleTask(current, payload);
          break;
        case 'service':
          await toggleService(current, payload);
          break;
      }

      return current;
    },

    async openStartupLocation(id) {
      const current = await ensureSnapshot();
      const entry: StartupAppEntry | undefined = current.apps.find((app) => app.id === id);
      if (!entry) throw notFound();
      if (entry.location) deps.revealItem(entry.location);
    },

    async stopStartupService(id) {
      const current = await ensureSnapshot();
      const service: StartupServiceEntry | undefined = current.services.find(
        (item) => item.id === id
      );
      if (!service) throw notFound();
      if (service.protected) {
        throw new Error('Serviço protegido: pará-lo pode interromper o Windows.');
      }
      requireAdmin(service);

      await deps.exec(buildStopServiceScript(service.name));
      service.state = 'Stopped';
      return current;
    },
  };
}

function parseServicesFromPayload(raw: unknown): StartupServiceEntry[] {
  return parseServices(JSON.stringify(raw ?? []));
}
