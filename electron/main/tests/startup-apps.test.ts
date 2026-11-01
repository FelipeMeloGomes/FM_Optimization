import { describe, expect, it } from 'vitest';
import type { StartupAppEntry } from '../../shared/ipc-types';
import {
  buildStartupAppToggleScript,
  parseExecutablePath,
  parseRegistryPayload,
  parseRunEntries,
  parseStartupAppId,
  parseStartupFolderEntries,
  startupAppId,
  startupAppRequiresAdmin,
} from '../services/startup-apps';

function base64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

const DISABLED = base64('030000000000000000000000');

describe('parseRunEntries', () => {
  it('parses an array of Run entries and their approved state', () => {
    const json = JSON.stringify([
      {
        source: 'registry-user',
        name: 'Steam',
        command: '"C:\\Steam\\steam.exe" -silent',
        approved: null,
      },
      {
        source: 'registry-machine',
        name: 'SecurityHealth',
        command: 'C:\\Windows\\system32\\SecurityHealthSystray.exe',
        approved: DISABLED,
      },
    ]);

    const entries = parseRunEntries(json);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'app:registry-user:Steam',
      name: 'Steam',
      source: 'registry-user',
      enabled: true,
      requiresAdmin: false,
      location: 'C:\\Steam\\steam.exe',
    });
    expect(entries[1]).toMatchObject({
      name: 'SecurityHealth',
      source: 'registry-machine',
      enabled: false,
      requiresAdmin: true,
    });
  });

  it('accepts a single object, which ConvertTo-Json emits for one entry', () => {
    const json = JSON.stringify({
      source: 'registry-user',
      name: 'OneDrive',
      command: '"C:\\Users\\me\\OneDrive.exe" /background',
      approved: null,
    });

    expect(parseRunEntries(json).map((e) => e.name)).toEqual(['OneDrive']);
  });

  it('skips unknown sources, empty names and malformed JSON', () => {
    const json = JSON.stringify([
      { source: 'registry-user', name: '', command: 'x', approved: null },
      { source: 'somewhere-else', name: 'Mystery', command: 'x', approved: null },
    ]);

    expect(parseRunEntries(json)).toEqual([]);
    expect(parseRunEntries('not json')).toEqual([]);
  });
});

describe('parseRegistryPayload', () => {
  it('reads run entries and the per-folder approved maps', () => {
    const payload = JSON.stringify({
      entries: [
        {
          source: 'registry-user',
          name: 'Steam',
          command: '"C:\\\\Steam\\\\steam.exe" -silent',
          approved: null,
        },
      ],
      folderApproved: {
        user: { 'OneDrive.lnk': DISABLED },
        machine: {},
      },
    });

    const parsed = parseRegistryPayload(payload);

    expect(parsed.entries.map((e) => e.name)).toEqual(['Steam']);
    expect(parsed.folderApproved.user['OneDrive.lnk']).toBe(DISABLED);
    expect(parsed.folderApproved.machine).toEqual({});
  });

  it('falls back to empty maps when the folder data is missing', () => {
    const parsed = parseRegistryPayload(JSON.stringify({ entries: [] }));

    expect(parsed.entries).toEqual([]);
    expect(parsed.folderApproved).toEqual({ user: {}, machine: {} });
  });

  it('rejects malformed input', () => {
    expect(parseRegistryPayload('nope')).toEqual({
      entries: [],
      folderApproved: { user: {}, machine: {} },
    });
  });
});

describe('parseStartupFolderEntries', () => {
  const dir = 'C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup';

  it('lists shortcuts and reads the approved state by file name', () => {
    const entries = parseStartupFolderEntries(
      ['OneDrive.lnk', 'desktop.ini', 'notes.txt'],
      { 'OneDrive.lnk': DISABLED },
      'folder-user',
      dir
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'app:folder-user:OneDrive.lnk',
      name: 'OneDrive.lnk',
      command: `${dir}\\OneDrive.lnk`,
      source: 'folder-user',
      enabled: false,
      requiresAdmin: false,
      location: `${dir}\\OneDrive.lnk`,
    });
  });

  it('marks machine folders as requiring admin', () => {
    const entries = parseStartupFolderEntries(
      ['agent.bat'],
      {},
      'folder-machine',
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'
    );

    expect(entries[0].requiresAdmin).toBe(true);
    expect(entries[0].enabled).toBe(true);
  });
});

describe('startupAppId', () => {
  it('round-trips a name that contains a colon', () => {
    const id = startupAppId('registry-user', 'Backup: diário');
    expect(parseStartupAppId(id)).toEqual({ source: 'registry-user', name: 'Backup: diário' });
  });

  it('rejects ids from another kind', () => {
    expect(parseStartupAppId('task:\\Foo')).toBeNull();
    expect(parseStartupAppId('app:registry-user:')).toBeNull();
  });
});

describe('startupAppRequiresAdmin', () => {
  it('only machine-wide sources need elevation', () => {
    expect(startupAppRequiresAdmin('registry-user')).toBe(false);
    expect(startupAppRequiresAdmin('folder-user')).toBe(false);
    expect(startupAppRequiresAdmin('registry-machine')).toBe(true);
    expect(startupAppRequiresAdmin('registry-machine-32')).toBe(true);
    expect(startupAppRequiresAdmin('folder-machine')).toBe(true);
  });
});

describe('parseExecutablePath', () => {
  it('reads a quoted executable', () => {
    expect(parseExecutablePath('"C:\\Program Files\\App\\app.exe" --flag')).toBe(
      'C:\\Program Files\\App\\app.exe'
    );
  });

  it('reads an unquoted absolute executable', () => {
    expect(parseExecutablePath('C:\\App\\app.exe --flag')).toBe('C:\\App\\app.exe');
  });

  it('returns null when the command has no absolute path', () => {
    expect(parseExecutablePath('rundll32.exe shell32.dll,Control_RunDLL')).toBeNull();
    expect(parseExecutablePath('')).toBeNull();
  });
});

describe('buildStartupAppToggleScript', () => {
  const entry: StartupAppEntry = {
    id: 'app:registry-user:Steam',
    name: 'Steam',
    command: '"C:\\Steam\\steam.exe" -silent',
    source: 'registry-user',
    enabled: true,
    requiresAdmin: false,
    location: 'C:\\Steam\\steam.exe',
  };

  it('disables a user entry by writing the blob to HKCU', () => {
    const script = buildStartupAppToggleScript(entry, false);

    expect(script).toContain(
      "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'"
    );
    expect(script).toContain("-Name 'Steam'");
    // O blob é escrito como byte array; o primeiro byte é o estado desativado.
    expect(script).toContain('0x03,0x00,0x00,0x00');
    expect(script).toContain('-Type Binary');
  });

  it('enables by removing the override instead of writing a blob', () => {
    const script = buildStartupAppToggleScript({ ...entry, enabled: false }, true);

    expect(script).toContain('Remove-ItemProperty');
    expect(script).toContain("-Name 'Steam'");
    expect(script).not.toContain('Set-ItemProperty');
  });

  it('writes machine entries to HKLM', () => {
    const script = buildStartupAppToggleScript(
      { ...entry, source: 'registry-machine', requiresAdmin: true },
      false
    );

    expect(script).toContain('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion');
  });

  it('writes 32-bit machine entries to the Run32 key', () => {
    const script = buildStartupAppToggleScript(
      { ...entry, source: 'registry-machine-32', requiresAdmin: true },
      false
    );

    expect(script).toContain('StartupApproved\\Run32');
  });

  it('writes 32-bit user entries to the HKCU Run32 key', () => {
    const script = buildStartupAppToggleScript({ ...entry, source: 'registry-user-32' }, false);

    expect(script).toContain(
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'
    );
  });

  it('creates the approved key when the profile does not have it yet', () => {
    const script = buildStartupAppToggleScript(entry, false);

    expect(script).toContain('New-Item -Path');
    expect(script).toContain('-Force');
  });

  it('writes folder entries to StartupFolder', () => {
    const script = buildStartupAppToggleScript(
      { ...entry, source: 'folder-user', name: 'OneDrive.lnk' },
      false
    );

    expect(script).toContain('StartupApproved\\StartupFolder');
    expect(script).toContain("-Name 'OneDrive.lnk'");
  });

  it('escapes single quotes in entry names', () => {
    const script = buildStartupAppToggleScript({ ...entry, name: "Bob's app" }, false);

    expect(script).toContain("-Name 'Bob''s app'");
  });
});
