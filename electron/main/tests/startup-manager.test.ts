import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StartupAppEntry } from '../../shared/ipc-types';
import { createStartupManager, type StartupManagerDeps } from '../services/startup-manager';
import { createStartupOverridesStore } from '../services/startup-overrides';

const tempDirs: string[] = [];

function makeDataDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'startup-manager-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function base64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

const DISABLED = base64('030000000000000000000000');

const USER_STARTUP =
  'C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup';
const MACHINE_STARTUP = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup';

const LIST_PAYLOAD = JSON.stringify({
  entries: [
    {
      source: 'registry-user',
      name: 'Steam',
      command: '"C:\\Steam\\steam.exe" -silent',
      approved: null,
    },
    {
      source: 'registry-machine',
      name: 'SecurityHealth',
      command: 'C:\\Windows\\System32\\SecurityHealthSystray.exe',
      approved: DISABLED,
    },
    {
      source: 'registry-user',
      name: 'Rundll',
      command: 'rundll32.exe shell32.dll,Control_RunDLL',
      approved: null,
    },
  ],
  folderApproved: {
    user: { 'OneDrive.lnk': DISABLED },
    machine: {},
  },
  tasks: [
    {
      name: 'OneDrive Standalone Update Task',
      path: '\\',
      state: 'Ready',
      trigger: 'logon',
      action: 'C:\\OneDrive.exe',
      author: 'Microsoft Corporation',
    },
    {
      name: 'Every day',
      path: '\\Custom',
      state: 'Ready',
      trigger: 'daily',
      action: 'x',
      author: 'Me',
    },
  ],
  services: [
    {
      name: 'Spooler',
      displayName: 'Print Spooler',
      startMode: 'Auto',
      state: 'Running',
      delayed: false,
    },
    {
      name: 'Fax',
      displayName: 'Fax',
      startMode: 'Manual',
      state: 'Stopped',
      delayed: false,
    },
    {
      name: 'WinDefend',
      displayName: 'Microsoft Defender',
      startMode: 'Auto',
      state: 'Running',
      delayed: false,
    },
  ],
});

function makeDeps(overrides: Partial<StartupManagerDeps> = {}) {
  const exec = vi.fn<(script: string) => Promise<string>>(async () => LIST_PAYLOAD);
  const revealItem = vi.fn<(path: string) => void>();
  const readDir = vi.fn<(dir: string) => string[]>((dir) =>
    dir === USER_STARTUP ? ['OneDrive.lnk', 'desktop.ini'] : []
  );

  const deps: StartupManagerDeps = {
    exec,
    isAdmin: () => true,
    readDir,
    revealItem,
    dataDir: makeDataDir(),
    startupDirs: { user: USER_STARTUP, machine: MACHINE_STARTUP },
    ...overrides,
  };

  return { deps, exec, revealItem, readDir };
}

async function loadedManager(overrides: Partial<StartupManagerDeps> = {}) {
  const { deps, exec, revealItem, readDir } = makeDeps(overrides);
  const manager = createStartupManager(deps);
  const snapshot = await manager.listStartup();
  return { manager, snapshot, deps, exec, revealItem, readDir };
}

describe('listStartup', () => {
  it('merges run keys, startup folders, tasks and services', async () => {
    const { snapshot } = await loadedManager();

    expect(snapshot.apps.map((a) => a.id)).toEqual([
      'app:registry-user:Steam',
      'app:registry-machine:SecurityHealth',
      'app:registry-user:Rundll',
      'app:folder-user:OneDrive.lnk',
    ]);
    expect(snapshot.apps[3].enabled).toBe(false);
    expect(snapshot.tasks.map((t) => t.name)).toEqual(['OneDrive Standalone Update Task']);
    // Ordenados por nome de exibição: "Microsoft Defender" < "Print Spooler".
    expect(snapshot.services.map((s) => s.name)).toEqual(['WinDefend', 'Spooler']);
    expect(snapshot.isAdmin).toBe(true);
  });

  it('reads both startup folders', async () => {
    const { readDir } = await loadedManager();

    expect(readDir).toHaveBeenCalledWith(USER_STARTUP);
    expect(readDir).toHaveBeenCalledWith(MACHINE_STARTUP);
  });
});

describe('setStartupEnabled', () => {
  it('rejects an unknown id', async () => {
    const { manager } = await loadedManager();

    await expect(
      manager.setStartupEnabled({ kind: 'app', id: 'app:registry-user:Nope', enabled: false })
    ).rejects.toThrow('não encontrada');
  });

  it('rejects a machine entry without administrator rights', async () => {
    const { manager } = await loadedManager({ isAdmin: () => false });

    await expect(
      manager.setStartupEnabled({
        kind: 'app',
        id: 'app:registry-machine:SecurityHealth',
        enabled: true,
      })
    ).rejects.toThrow('administrador');
  });

  it('disables a user app by writing the approved blob', async () => {
    const { manager, exec } = await loadedManager();
    exec.mockClear();

    await manager.setStartupEnabled({ kind: 'app', id: 'app:registry-user:Steam', enabled: false });

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toContain('StartupApproved\\Run');
    expect(exec.mock.calls[0][0]).toContain('-Type Binary');
  });

  it('disables and re-enables a task', async () => {
    const { manager, exec } = await loadedManager();
    exec.mockClear();

    await manager.setStartupEnabled({
      kind: 'task',
      id: 'task:\\OneDrive Standalone Update Task',
      enabled: false,
    });
    expect(exec.mock.calls[0][0]).toContain('Disable-ScheduledTask');

    await manager.setStartupEnabled({
      kind: 'task',
      id: 'task:\\OneDrive Standalone Update Task',
      enabled: true,
    });
    expect(exec.mock.calls[1][0]).toContain('Enable-ScheduledTask');
  });

  it('records the original start mode when disabling a service', async () => {
    const { manager, exec, deps } = await loadedManager();
    exec.mockClear();

    await manager.setStartupEnabled({
      kind: 'service',
      id: 'service:Spooler',
      enabled: false,
    });

    expect(exec.mock.calls[0][0]).toContain("Set-Service -Name 'Spooler' -StartupType Disabled");
    const store = createStartupOverridesStore(deps.dataDir);
    expect(store.getServiceStartMode('Spooler')).toBe('Automatic');
  });

  it('restores the recorded start mode and clears the override', async () => {
    const { manager, exec, deps } = await loadedManager();
    const store = createStartupOverridesStore(deps.dataDir);
    store.recordServiceStartMode('Spooler', 'AutomaticDelayed');
    exec.mockClear();

    await manager.setStartupEnabled({ kind: 'service', id: 'service:Spooler', enabled: true });

    expect(exec.mock.calls[0][0]).toContain('sc.exe config "Spooler" start= delayed-auto');
    expect(store.getServiceStartMode('Spooler')).toBeNull();
  });

  it('refuses to disable a protected service', async () => {
    const { manager, exec } = await loadedManager();
    exec.mockClear();

    await expect(
      manager.setStartupEnabled({ kind: 'service', id: 'service:WinDefend', enabled: false })
    ).rejects.toThrow('protegido');
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('openStartupLocation', () => {
  it('reveals the executable of an app', async () => {
    const { manager, revealItem } = await loadedManager();

    await manager.openStartupLocation('app:registry-user:Steam');

    expect(revealItem).toHaveBeenCalledWith('C:\\Steam\\steam.exe');
  });

  it('does nothing for an app with no resolvable location', async () => {
    const { manager, revealItem } = await loadedManager();

    await manager.openStartupLocation('app:registry-user:Rundll');

    expect(revealItem).not.toHaveBeenCalled();
  });

  it('rejects an unknown id', async () => {
    const { manager } = await loadedManager();

    await expect(manager.openStartupLocation('app:registry-user:Nope')).rejects.toThrow(
      'não encontrada'
    );
  });
});

describe('stopStartupService', () => {
  it('stops a running service', async () => {
    const { manager, exec } = await loadedManager();
    exec.mockClear();

    await manager.stopStartupService('service:Spooler');

    expect(exec.mock.calls[0][0]).toContain("Stop-Service -Name 'Spooler' -Force");
  });

  it('refuses to stop a protected service', async () => {
    const { manager, exec } = await loadedManager();
    exec.mockClear();

    await expect(manager.stopStartupService('service:WinDefend')).rejects.toThrow('protegido');
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('StartupAppEntry location typing', () => {
  it('keeps location nullable', () => {
    const entry: StartupAppEntry = {
      id: 'app:registry-user:X',
      name: 'X',
      command: 'rundll32.exe foo.dll',
      source: 'registry-user',
      enabled: true,
      requiresAdmin: false,
      location: null,
    };
    expect(entry.location).toBeNull();
  });
});
