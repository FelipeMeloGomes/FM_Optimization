import { describe, expect, it, vi } from 'vitest';
import {
  assertRestoreAllowed,
  buildInstallArgs,
  isPackageInstalled,
  parseCodePathLines,
  parsePackagePaths,
  parsePmResult,
  pmCommandSucceeded,
  removeAppFlow,
  resolveBackupPaths,
  resolveLabel,
  restoreOnDevice,
} from '../services/adb';
import type { RemovedAppRecord } from '../services/removed-apps';

function parseDevicesOutput(
  output: string
): Array<{ serial: string; state: string; model?: string }> {
  const lines = output
    .split('\n')
    .slice(1)
    .filter((l) => l.trim());
  const devices: Array<{ serial: string; state: string; model?: string }> = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const serial = parts[0];
    const state = parts[1];
    if (!['device', 'offline', 'unauthorized'].includes(state)) continue;

    const device: { serial: string; state: string; model?: string } = { serial, state };
    const modelMatch = line.match(/model:(\S+)/);
    if (modelMatch) device.model = modelMatch[1];

    devices.push(device);
  }

  return devices;
}

function parseAppsOutput(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('package:'))
    .map((pkg) => pkg.replace('package:', '').split('=').pop() || '');
}

describe('parseDevicesOutput', () => {
  it('parses connected devices', () => {
    const output =
      'List of devices attached\nemulator-5554\tdevice product:sdk_gphone model:sdk_gphone64_x86_64\n';
    const devices = parseDevicesOutput(output);
    expect(devices).toHaveLength(1);
    expect(devices[0].serial).toBe('emulator-5554');
    expect(devices[0].state).toBe('device');
    expect(devices[0].model).toBe('sdk_gphone64_x86_64');
  });

  it('handles offline devices', () => {
    const output = 'List of devices attached\nemulator-5554\toffline\n';
    const devices = parseDevicesOutput(output);
    expect(devices).toHaveLength(1);
    expect(devices[0].state).toBe('offline');
  });

  it('ignores unauthorized devices', () => {
    const output = 'List of devices attached\nemulator-5554\tunauthorized\n';
    const devices = parseDevicesOutput(output);
    expect(devices).toHaveLength(1);
    expect(devices[0].state).toBe('unauthorized');
  });

  it('handles empty output', () => {
    const output = 'List of devices attached\n';
    const devices = parseDevicesOutput(output);
    expect(devices).toHaveLength(0);
  });

  it('handles multiple devices', () => {
    const output =
      'List of devices attached\nemulator-5554\tdevice product:sdk_gphone model:Pixel_4\nemulator-5556\tdevice product:sdk_gphone model:Pixel_6\n';
    const devices = parseDevicesOutput(output);
    expect(devices).toHaveLength(2);
    expect(devices[0].serial).toBe('emulator-5554');
    expect(devices[1].serial).toBe('emulator-5556');
  });
});

describe('parseAppsOutput', () => {
  it('parses package list', () => {
    const output =
      'package:/system/app/Chrome/Chrome.apk=com.android.chrome\npackage:/data/app/Spotify/Spotify.apk=com.spotify.music\n';
    const packages = parseAppsOutput(output);
    expect(packages).toHaveLength(2);
    expect(packages[0]).toBe('com.android.chrome');
    expect(packages[1]).toBe('com.spotify.music');
  });

  it('filters non-package lines', () => {
    const output = 'package:/system/app/Chrome/Chrome.apk=com.android.chrome\n';
    const packages = parseAppsOutput(output);
    expect(packages).toHaveLength(1);
  });

  it('handles empty output', () => {
    const output = '';
    const packages = parseAppsOutput(output);
    expect(packages).toHaveLength(0);
  });
});

describe('parsePackagePaths', () => {
  it('parses single path', () => {
    expect(parsePackagePaths('package:/system/app/Foo/Foo.apk\n')).toEqual([
      '/system/app/Foo/Foo.apk',
    ]);
  });

  it('parses base + split parts', () => {
    const out =
      'package:/data/app/com.foo-1/base.apk\npackage:/data/app/com.foo-1/split_config.arm64_v8a.apk\n';
    const paths = parsePackagePaths(out);
    expect(paths).toHaveLength(2);
    expect(paths[1]).toBe('/data/app/com.foo-1/split_config.arm64_v8a.apk');
  });

  it('ignores non-package lines', () => {
    expect(parsePackagePaths('Warning: something\n')).toEqual([]);
  });
});

describe('buildInstallArgs', () => {
  it('uses install for a single file', () => {
    expect(buildInstallArgs(['/a.apk'])).toEqual(['install', '-r', '/a.apk']);
  });

  it('uses install-multiple for several parts', () => {
    expect(buildInstallArgs(['/base.apk', '/split.apk'])).toEqual([
      'install-multiple',
      '-r',
      '/base.apk',
      '/split.apk',
    ]);
  });
});

describe('resolveLabel', () => {
  it('uses known label', () => {
    expect(resolveLabel('com.spotify.music')).toBe('Spotify');
  });

  it('falls back to capitalized last segment', () => {
    expect(resolveLabel('com.unknown.example')).toBe('Example');
  });
});

describe('assertRestoreAllowed', () => {
  const rec: RemovedAppRecord = {
    packageName: 'com.a',
    label: 'A',
    instanceId: 'bs-64-bit',
    instanceName: 'BlueStacks 64-bit',
    arch: '64-bit',
    removedAt: '2026-09-06T00:00:00.000Z',
    mode: 'uninstalled',
    hasBackup: true,
    backupPath: '/tmp/a.apk',
  };

  it('allows matching instance with backup', () => {
    expect(() => assertRestoreAllowed(rec, 'bs-64-bit')).not.toThrow();
  });

  it('blocks missing record', () => {
    expect(() => assertRestoreAllowed(undefined, 'bs-64-bit')).toThrow(/registro/);
  });

  it('blocks different instance', () => {
    expect(() => assertRestoreAllowed(rec, 'rog-phone')).toThrow(/instância/);
  });

  it('blocks missing backup', () => {
    expect(() => assertRestoreAllowed({ ...rec, hasBackup: false }, 'bs-64-bit')).toThrow(/backup/);
  });

  it('allows disabled app without backup', () => {
    expect(() =>
      assertRestoreAllowed({ ...rec, mode: 'disabled', hasBackup: false }, 'bs-64-bit')
    ).not.toThrow();
  });
});

describe('parsePmResult', () => {
  it('recognizes success', () => {
    expect(parsePmResult('Success')).toEqual({ ok: true });
  });

  it('recognizes empty output as ok', () => {
    expect(parsePmResult('')).toEqual({ ok: true });
  });

  it('parses failure with reason', () => {
    expect(parsePmResult('Failure [DELETE_FAILED_PROTECTED_PACKAGE]')).toEqual({
      ok: false,
      reason: 'DELETE_FAILED_PROTECTED_PACKAGE',
    });
  });

  it('parses failure without brackets', () => {
    expect(parsePmResult('Failure not installed for 0')).toEqual({
      ok: false,
      reason: 'not installed for 0',
    });
  });
});

describe('pmCommandSucceeded', () => {
  it('returns ok for exit 0 with Success output', () => {
    expect(pmCommandSucceeded({ code: 0, stdout: 'Success', stderr: '' })).toEqual({ ok: true });
  });

  it('fails on Failure in stdout even with exit 0', () => {
    expect(
      pmCommandSucceeded({
        code: 0,
        stdout: 'Failure [DELETE_FAILED_PROTECTED_PACKAGE]',
        stderr: '',
      })
    ).toEqual({ ok: false, reason: 'DELETE_FAILED_PROTECTED_PACKAGE' });
  });

  it('fails on non-zero exit with empty stdout', () => {
    expect(pmCommandSucceeded({ code: 1, stdout: '', stderr: '' })).toEqual({
      ok: false,
      reason: 'adb exited with code 1',
    });
  });

  it('prefers stderr as reason on non-zero exit', () => {
    expect(pmCommandSucceeded({ code: 1, stdout: 'Success', stderr: 'boom' })).toEqual({
      ok: false,
      reason: 'boom',
    });
  });
});

type Exec = (args: string[]) => Promise<string>;

describe('isPackageInstalled', () => {
  it('returns true when pm path reports a package line', async () => {
    const exec: Exec = async () => 'package:/system/app/Foo/Foo.apk\n';
    await expect(isPackageInstalled(exec, 'emulator-5554', 'com.foo')).resolves.toBe(true);
  });

  it('returns false when pm path output is empty', async () => {
    const exec: Exec = async () => '';
    await expect(isPackageInstalled(exec, 'emulator-5554', 'com.foo')).resolves.toBe(false);
  });

  it('returns false when the adb command fails', async () => {
    const exec: Exec = async () => {
      throw new Error('device offline');
    };
    await expect(isPackageInstalled(exec, 'emulator-5554', 'com.foo')).resolves.toBe(false);
  });
});

describe('restoreOnDevice', () => {
  it('restores with pm install-existing when the system APK is still present', async () => {
    const calls: string[][] = [];
    const exec: Exec = async (args) => {
      calls.push(args);
      if (args.includes('path')) return 'package:/system/app/Foo/Foo.apk\n';
      return 'Success';
    };

    await restoreOnDevice(exec, 'emulator-5554', 'com.foo', ['/bk/com.foo.apk']);

    const cmds = calls.map((a) => a.join(' '));
    expect(cmds[0]).toBe('-s emulator-5554 shell pm install-existing --user 0 com.foo');
    expect(cmds.some((c) => c.includes('install -r'))).toBe(false);
  });

  it('falls back to adb install with the backup when install-existing does not restore', async () => {
    const calls: string[][] = [];
    let pathCalls = 0;
    const exec: Exec = async (args) => {
      calls.push(args);
      if (args.includes('path')) {
        pathCalls++;
        return pathCalls === 1 ? '' : 'package:/data/app/com.foo/base.apk\n';
      }
      return 'Success';
    };

    await restoreOnDevice(exec, 'emulator-5554', 'com.foo', ['/bk/com.foo.apk']);

    const cmds = calls.map((a) => a.join(' '));
    expect(cmds[0]).toContain('pm install-existing --user 0 com.foo');
    expect(cmds.some((c) => c === '-s emulator-5554 install -r /bk/com.foo.apk')).toBe(true);
  });

  it('falls back to adb install when the install-existing command fails', async () => {
    const calls: string[][] = [];
    const exec: Exec = async (args) => {
      calls.push(args);
      if (args.includes('install-existing')) throw new Error('Error: package not found');
      if (args.includes('path')) return 'package:/data/app/com.foo/base.apk\n';
      return 'Success';
    };

    await restoreOnDevice(exec, 'emulator-5554', 'com.foo', ['/bk/com.foo.apk']);

    const cmds = calls.map((a) => a.join(' '));
    expect(cmds[0]).toBe('-s emulator-5554 shell pm install-existing --user 0 com.foo');
    expect(cmds.some((c) => c === '-s emulator-5554 install -r /bk/com.foo.apk')).toBe(true);
  });

  it('throws when the package does not come back after every attempt', async () => {
    const calls: string[][] = [];
    const exec: Exec = async (args) => {
      calls.push(args);
      if (args.includes('path')) return '';
      return 'Success';
    };

    await expect(
      restoreOnDevice(exec, 'emulator-5554', 'com.foo', ['/bk/com.foo.apk'])
    ).rejects.toThrow(/não voltou a ficar instalado/);
    expect(calls.map((a) => a.join(' ')).some((c) => c.includes('install -r'))).toBe(true);
  });

  it('reports missing backup files when install-existing fails and no backups exist', async () => {
    const exec: Exec = async (args) => {
      if (args.includes('path')) return '';
      return 'Success';
    };

    await expect(restoreOnDevice(exec, 'emulator-5554', 'com.foo', [])).rejects.toThrow(
      /Arquivos de backup/
    );
  });
});

describe('parseCodePathLines', () => {
  it('extracts codePath values from dumpsys output', () => {
    const output = [
      'Package [com.android.chrome] (2d0ee2c):',
      '    userId=1000',
      '    codePath=/data/downloads/com.android.chrome',
      '    resourcePath=/data/downloads/com.android.chrome',
      '    legacyNativeLibraryDir=/data/downloads/com.android.chrome/lib',
    ].join('\n');
    expect(parseCodePathLines(output)).toEqual(['/data/downloads/com.android.chrome']);
  });

  it('returns every codePath when an updated copy exists', () => {
    const output = [
      '    codePath=/data/app/com.android.contacts-abc/base.apk',
      '    codePath=/system/priv-app/Contacts',
    ].join('\n');
    expect(parseCodePathLines(output)).toEqual([
      '/data/app/com.android.contacts-abc/base.apk',
      '/system/priv-app/Contacts',
    ]);
  });

  it('returns empty when no codePath is present', () => {
    expect(parseCodePathLines('Package [x]: not found')).toEqual([]);
  });
});

describe('resolveBackupPaths', () => {
  it('prefers explicit pm paths over the codePath fallback', () => {
    expect(resolveBackupPaths(['/system/app/A.apk'], ['/data/app/A/base.apk'])).toEqual([
      '/system/app/A.apk',
    ]);
  });

  it('falls back to codePath/base.apk when pm path is empty', () => {
    expect(resolveBackupPaths([], ['/data/downloads/com.android.chrome'])).toEqual([
      '/data/downloads/com.android.chrome/base.apk',
    ]);
  });

  it('keeps a codePath that already points to a file', () => {
    expect(resolveBackupPaths([], ['/data/app/com.android.chrome/base.apk'])).toEqual([
      '/data/app/com.android.chrome/base.apk',
    ]);
  });

  it('dedupes repeated codePath-derived sources', () => {
    expect(resolveBackupPaths([], ['/a/chrome', '/a/chrome'])).toEqual(['/a/chrome/base.apk']);
  });

  it('returns empty when there is nothing to pull', () => {
    expect(resolveBackupPaths([], [])).toEqual([]);
  });
});

describe('removeAppFlow', () => {
  const ctx = {
    serial: 'emulator-5554',
    instanceId: 'pie-64',
    instanceName: 'Dubronxx',
    arch: '64-bit',
    packageName: 'com.foo',
  };

  const ok = (stdout = 'Success') => ({ code: 0, stdout, stderr: '' });

  it('backs up the app before uninstalling, even outside /system paths', async () => {
    const events: string[] = [];
    const result = await removeAppFlow(
      {
        execResult: async () => {
          events.push('uninstall');
          return ok();
        },
        backupApp: async () => {
          events.push('backup');
          return 'C:/data/backups/pie-64/com.foo.apk';
        },
        record: (rec) => {
          events.push(`record:${rec.mode}:hasBackup=${rec.hasBackup}`);
        },
        deleteBackups: () => events.push('deleteBackups'),
      },
      ctx
    );

    expect(result).toEqual({ mode: 'uninstalled', hasBackup: true });
    expect(events).toEqual(['backup', 'uninstall', 'record:uninstalled:hasBackup=true']);
  });

  it('backs up even a critical system package — there is no package allow/deny list', async () => {
    const events: string[] = [];
    const result = await removeAppFlow(
      {
        execResult: async () => {
          events.push('uninstall');
          return ok();
        },
        backupApp: async () => {
          events.push('backup');
          return 'C:/data/backups/pie-64/com.android.systemui.apk';
        },
        record: (rec) =>
          events.push(`record:${rec.mode}:hasBackup=${rec.hasBackup}:pkg=${rec.packageName}`),
        deleteBackups: () => events.push('deleteBackups'),
      },
      { ...ctx, packageName: 'com.android.systemui' }
    );

    expect(result).toEqual({ mode: 'uninstalled', hasBackup: true });
    expect(events).toEqual([
      'backup',
      'uninstall',
      'record:uninstalled:hasBackup=true:pkg=com.android.systemui',
    ]);
  });

  it('still uninstalls and records hasBackup=false when the backup fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const records: Array<{ mode: string; hasBackup: boolean; backupPath?: string }> = [];
    try {
      const result = await removeAppFlow(
        {
          execResult: async () => ok(),
          backupApp: async () => {
            throw new Error('pull failed');
          },
          record: (rec) => records.push(rec),
          deleteBackups: () => {},
        },
        ctx
      );

      expect(result).toEqual({ mode: 'uninstalled', hasBackup: false });
      expect(records).toHaveLength(1);
      expect(records[0].hasBackup).toBe(false);
      expect(records[0].backupPath).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('falls back to disabling when uninstall fails', async () => {
    const events: string[] = [];
    const result = await removeAppFlow(
      {
        execResult: async (args) => {
          if (args.includes('uninstall'))
            return { code: 0, stdout: 'Failure [DELETE_FAILED_INTERNAL_ERROR]', stderr: '' };
          events.push('disable');
          return ok();
        },
        backupApp: async () => '/bk/com.foo.apk',
        record: (rec) => events.push(`record:${rec.mode}`),
        deleteBackups: () => events.push('deleteBackups'),
      },
      ctx
    );

    expect(result).toEqual({ mode: 'disabled', hasBackup: true });
    expect(events).toEqual(['disable', 'record:disabled']);
  });

  it('cleans up backups and throws when the app cannot be removed', async () => {
    const events: string[] = [];
    const failing = {
      code: 0,
      stdout: 'Failure [DELETE_FAILED_DEVICE_POLICY_MANAGER]',
      stderr: '',
    };
    await expect(
      removeAppFlow(
        {
          execResult: async () => failing,
          backupApp: async () => '/bk/com.foo.apk',
          record: () => events.push('record'),
          deleteBackups: () => events.push('deleteBackups'),
        },
        ctx
      )
    ).rejects.toThrow(/Não foi possível remover/);
    expect(events).toEqual(['deleteBackups']);
  });
});
