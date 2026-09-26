import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import type {
  AppSettings,
  BenchmarkResult,
  IpcResult,
  SetPageLockPasswordResult,
} from '../shared/ipc-types';
import { auditIpcValidation } from './audit-logger';
import { resolveScriptId } from './legacy-script-ids';
import {
  backupApp,
  clearRemovedApp,
  clearRemovedHistory,
  detectEmulatorAdbPath,
  detectEmulatorVersion,
  getAdbPath,
  listApps,
  listDevices,
  listEmulatorInstances,
  listRemovedApps,
  removeApp,
  restoreApp,
  restoreAppByName,
  restoreRemovedApp,
  setAdbPath,
} from './services/adb';
import { isAdmin } from './services/admin-check';
import { getCleanerStats } from './services/cleaner-stats';
import { loadSettings, loadUserData, saveSettings, saveUserData } from './services/data-service';
import { generateSalt, hashPassword, verifyPassword } from './services/page-lock';
import { execPowerShell, execPowerShellSafe } from './services/powershell';
import { checkRateLimit } from './services/rate-limit';
import {
  createRestorePoint,
  deleteRestorePoint,
  getRestorePoints,
  restoreSystem,
} from './services/restore-points';
import { cancelExecution, executeScript } from './services/script-executor';
import { loadScripts } from './services/script-registry';
import {
  getCpuInfo,
  getMemoryInfo,
  getSystemInfo,
  hasSolidStateDrive,
} from './services/system-info';
import { validateIpcInput } from './validation';

function handleIpc<T, V>(
  channel: string,
  input: unknown,
  fn: (validated: V) => T | Promise<T>
): Promise<IpcResult<T>> {
  const limit = checkRateLimit(channel);
  if (!limit.allowed) {
    return Promise.resolve({
      success: false as const,
      error: `Rate limit excedido. Tente novamente em ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    });
  }

  const validation = validateIpcInput<V>(channel, input);
  auditIpcValidation(
    channel,
    validation.success,
    validation.success ? undefined : validation.error
  );
  if (!validation.success) {
    return Promise.resolve({ success: false as const, error: validation.error });
  }
  try {
    const result = fn(validation.data);
    return Promise.resolve(result).then(
      (data) => ({ success: true as const, data }),
      (e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : String(e),
      })
    );
  } catch (e: unknown) {
    return Promise.resolve({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function handleIpcNoInput<T>(channel: string, fn: () => T): Promise<IpcResult<T>> {
  return handleIpc(channel, undefined, () => fn());
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-system-info', async () => {
    try {
      return { success: true as const, data: await getSystemInfo() };
    } catch (e: unknown) {
      return { success: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // Sub-handlers modulares (carregamento sob demanda por página)
  ipcMain.handle('get-cpu-info', () => handleIpcNoInput('get-cpu-info', () => getCpuInfo()));
  ipcMain.handle('get-memory-info', () =>
    handleIpcNoInput('get-memory-info', () => getMemoryInfo())
  );
  ipcMain.handle('has-ssd', () => handleIpcNoInput('has-ssd', () => hasSolidStateDrive()));

  ipcMain.handle('get-scripts', () => handleIpcNoInput('get-scripts', () => loadScripts()));

  ipcMain.handle('execute-script', (_e, id: string) => {
    return handleIpc('execute-script', id, (validated) => {
      executeScript(validated as string);
    });
  });

  ipcMain.handle('cancel-execution', (_e, id: string) => {
    return handleIpc('cancel-execution', id, (validated) => {
      cancelExecution(validated as string);
    });
  });

  ipcMain.handle('get-restore-points', () =>
    handleIpcNoInput('get-restore-points', () => getRestorePoints())
  );

  ipcMain.handle('create-restore-point', (_e, name: string) => {
    return handleIpc('create-restore-point', name, (validated) => {
      createRestorePoint(validated as string);
    });
  });

  ipcMain.handle('delete-restore-point', (_e, seq: number) => {
    return handleIpc('delete-restore-point', seq, (validated) => {
      deleteRestorePoint(validated as number);
    });
  });

  ipcMain.handle('is-admin', () => handleIpcNoInput('is-admin', () => isAdmin()));

  ipcMain.handle('get-settings', () => handleIpcNoInput('get-settings', () => loadSettings()));

  ipcMain.handle('save-settings', (_e, settings) => {
    return handleIpc('save-settings', settings, (validated) => {
      saveSettings(validated as AppSettings);
    });
  });

  ipcMain.handle('verify-page-lock-password', (_e, payload: unknown) => {
    return handleIpc('verify-page-lock-password', payload, (validated) => {
      const { password } = validated as { password: string };
      const settings = loadSettings();
      const { salt, passwordHashCipher } = settings.pageLock;
      if (!passwordHashCipher) {
        return false;
      }
      return verifyPassword(password, salt, passwordHashCipher);
    });
  });

  ipcMain.handle('set-page-lock-password', (_e, payload: unknown) => {
    return handleIpc('set-page-lock-password', payload, (validated) => {
      const { password } = validated as { password: string };
      const salt = generateSalt();
      const result: SetPageLockPasswordResult = {
        salt,
        passwordHashCipher: hashPassword(password, salt),
      };
      return result;
    });
  });

  ipcMain.handle('get-app-version', () =>
    handleIpcNoInput('get-app-version', () => app.getVersion())
  );

  ipcMain.handle('is-packaged', () => handleIpcNoInput('is-packaged', () => app.isPackaged));

  ipcMain.handle('get-execution-history', () =>
    handleIpcNoInput('get-execution-history', () => loadUserData().executionHistory || [])
  );

  ipcMain.handle('restore-system', (_e, seq: number) => {
    return handleIpc('restore-system', seq, (validated) => {
      restoreSystem(validated as number);
    });
  });

  ipcMain.handle('check-for-update', () => {
    if (!app.isPackaged) {
      return { success: false as const, error: 'Updates only work in packaged app' };
    }
    return handleIpcNoInput('check-for-update', () => {
      autoUpdater.checkForUpdates();
    });
  });

  ipcMain.handle('download-update', () =>
    handleIpcNoInput('download-update', () => {
      autoUpdater.downloadUpdate();
    })
  );

  ipcMain.handle('install-update', () =>
    handleIpcNoInput('install-update', () => {
      autoUpdater.quitAndInstall();
    })
  );

  ipcMain.handle('get-network-info', async () => {
    return handleIpc('get-network-info', undefined, async () => {
      try {
        const ps = `
          $adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1
          if (-not $adapter) { throw "Nenhuma interface de rede ativa encontrada" }
          $dns = Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4
          $dnsServers = @()
          if ($dns) { $dnsServers = $dns.ServerAddresses }
          @{ interfaceName = $adapter.Name; interfaceIndex = $adapter.InterfaceIndex; currentDns = $dnsServers } | ConvertTo-Json -Compress
        `;
        const output = await execPowerShell(ps);
        const parsed = JSON.parse(output.trim());
        return {
          interfaceName: parsed.interfaceName,
          interfaceIndex: parsed.interfaceIndex,
          currentDns: parsed.currentDns || [],
        };
      } catch (e: unknown) {
        throw new Error(e instanceof Error ? e.message : String(e));
      }
    });
  });

  ipcMain.handle('benchmark-dns', async (event, providers: unknown) => {
    return handleIpc('benchmark-dns', providers, async (validated) => {
      const providerList = (validated as { providers: { primary: string; secondary: string }[] })
        .providers;
      const total = providerList.length;
      const results: BenchmarkResult[] = [];
      for (let i = 0; i < providerList.length; i++) {
        const { primary, secondary } = providerList[i];
        for (const addr of [primary, secondary]) {
          try {
            // addr is validated as IPv4 by DnsAddressesSchema before reaching here
            const script = `$r = Test-Connection -Count 2 -ComputerName "${addr}" -ErrorAction Stop; Write-Output (($r | Measure-Object -Property ResponseTime -Average).Average)`;
            const output = await execPowerShell(script);
            const ms = parseFloat(output.trim().split('\n').pop() || '');
            results.push({ address: addr, latencyMs: Number.isNaN(ms) ? null : Math.round(ms) });
          } catch {
            results.push({ address: addr, latencyMs: null });
          }
        }
        event.sender.send('benchmark-progress', { current: i + 1, total });
        for (const addr of [primary, secondary]) {
          const r = results.find((x) => x.address === addr);
          if (r) event.sender.send('benchmark-result', r);
        }
      }
      return results;
    });
  });

  ipcMain.handle('apply-dns', async (_e, payload: unknown) => {
    return handleIpc('apply-dns', payload, async (validated) => {
      const { interfaceIndex: idx, addresses: addrs } = validated as {
        interfaceIndex: number;
        addresses: string[];
      };
      if (!isAdmin()) {
        throw new Error('Execute o aplicativo como administrador para alterar o DNS.');
      }
      if (addrs.length === 0) {
        await execPowerShellSafe('Set-DnsClientServerAddress', [
          '-InterfaceIndex',
          idx.toString(),
          '-ResetServerAddresses',
        ]);
      } else {
        await execPowerShellSafe('Set-DnsClientServerAddress', [
          '-InterfaceIndex',
          idx.toString(),
          '-ServerAddresses',
          addrs.join(','),
        ]);
        await execPowerShellSafe('ipconfig', ['/flushdns']);
      }
    });
  });

  ipcMain.handle('window-minimize', () =>
    handleIpcNoInput('window-minimize', () => {
      BrowserWindow.getFocusedWindow()?.minimize();
      return { success: true };
    })
  );

  ipcMain.handle('window-close', () =>
    handleIpcNoInput('window-close', () => {
      BrowserWindow.getFocusedWindow()?.close();
      return { success: true };
    })
  );

  ipcMain.handle('export-data', () =>
    handleIpcNoInput('export-data', () => {
      const settings = loadSettings();
      const userData = loadUserData();
      return {
        version: app.getVersion(),
        exportedAt: new Date().toISOString(),
        settings,
        history: userData.executionHistory || [],
      };
    })
  );

  ipcMain.handle('import-data', (_e, jsonData: string) => {
    return handleIpc('import-data', jsonData, (validated) => {
      const data = JSON.parse(validated as string);
      if (data.settings) {
        const current = loadSettings();
        saveSettings({ ...current, ...data.settings });
      }
      if (data.history && Array.isArray(data.history)) {
        const current = loadUserData();
        const existingIds = new Set(current.executionHistory.map((h) => h.id));
        const newEntries = data.history.filter((h: { id: string }) => !existingIds.has(h.id));
        saveUserData({
          ...current,
          executionHistory: [...newEntries, ...current.executionHistory],
        });
      }
      return { success: true };
    });
  });

  ipcMain.handle('adb:get-path', () => handleIpcNoInput('adb:get-path', () => getAdbPath()));

  ipcMain.handle('adb:set-path', (_e, payload: unknown) => {
    return handleIpc('adb:set-path', payload, (validated) => {
      setAdbPath((validated as { path: string }).path);
    });
  });

  ipcMain.handle('adb:list-devices', () =>
    handleIpcNoInput('adb:list-devices', () => listDevices())
  );

  ipcMain.handle('adb:detect-emulator', (_e, payload: unknown) => {
    return handleIpc('adb:detect-emulator', payload, (validated) => {
      const { emulatorId } = validated as { emulatorId: string };
      const pathResult = detectEmulatorAdbPath(emulatorId);
      // Se não instalado, retorna versão null
      if (!pathResult.installed) return { installed: false, adbPath: '' };
      // Se instalado, detecta versão
      return detectEmulatorVersion(emulatorId).then((version) => ({
        installed: true,
        adbPath: pathResult.adbPath,
        version,
      }));
    });
  });

  ipcMain.handle('adb:list-apps', (_e, payload: unknown) => {
    return handleIpc('adb:list-apps', payload, (validated) => {
      return listApps((validated as { serial: string }).serial);
    });
  });

  ipcMain.handle('adb:remove-app', (_e, payload: unknown) => {
    return handleIpc('adb:remove-app', payload, (validated) => {
      const { serial, instanceId, instanceName, arch, packageName } = validated as {
        serial: string;
        instanceId: string;
        instanceName?: string;
        arch?: string;
        packageName: string;
      };
      return removeApp(serial, instanceId, instanceName ?? '', arch ?? '', packageName);
    });
  });

  ipcMain.handle('adb:backup-app', (_e, payload: unknown) => {
    return handleIpc('adb:backup-app', payload, (validated) => {
      const { serial, instanceId, packageName } = validated as {
        serial: string;
        instanceId: string;
        packageName: string;
      };
      return backupApp(serial, instanceId, packageName);
    });
  });

  ipcMain.handle('adb:restore-app', (_e, payload: unknown) => {
    return handleIpc('adb:restore-app', payload, (validated) => {
      const { serial, apkPath } = validated as { serial: string; apkPath: string };
      return restoreApp(serial, apkPath);
    });
  });

  ipcMain.handle('adb:restore-app-by-name', (_e, payload: unknown) => {
    return handleIpc('adb:restore-app-by-name', payload, (validated) => {
      const { serial, instanceId, packageName } = validated as {
        serial: string;
        instanceId: string;
        packageName: string;
      };
      return restoreAppByName(serial, instanceId, packageName);
    });
  });

  ipcMain.handle('adb:list-removed', () =>
    handleIpcNoInput('adb:list-removed', () => listRemovedApps())
  );

  ipcMain.handle('adb:restore-removed', (_e, payload: unknown) => {
    return handleIpc('adb:restore-removed', payload, (validated) => {
      const { serial, instanceId, packageName } = validated as {
        serial: string;
        instanceId: string;
        packageName: string;
      };
      return restoreRemovedApp(serial, instanceId, packageName);
    });
  });

  ipcMain.handle('adb:clear-removed', (_e, payload: unknown) => {
    return handleIpc('adb:clear-removed', payload, (validated) => {
      return clearRemovedApp((validated as { packageName: string }).packageName);
    });
  });

  ipcMain.handle('adb:clear-removed-history', () =>
    handleIpcNoInput('adb:clear-removed-history', () => clearRemovedHistory())
  );

  ipcMain.handle('adb:list-instances', (_e, payload: unknown) => {
    return handleIpc('adb:list-instances', payload, (validated) => {
      return listEmulatorInstances((validated as { emulatorId: string }).emulatorId);
    });
  });

  ipcMain.handle('get-cleaner-stats', (_e, cleanerId: string) => {
    return handleIpc('get-cleaner-stats', cleanerId, (validated) => {
      return getCleanerStats(validated as string);
    });
  });

  ipcMain.handle('elevate-app', (_e, payload: unknown) =>
    handleIpc(
      'elevate-app',
      payload,
      async (validated: {
        scriptId?: string;
        dnsInterfaceIndex?: number;
        dnsAddresses?: string[];
      }) => {
        // Validate scriptId against allowlist
        if (validated.scriptId) {
          const scripts = loadScripts();
          const validIds = new Set(scripts.map((s) => s.id));
          if (!validIds.has(resolveScriptId(validated.scriptId))) {
            throw new Error(`Invalid scriptId: ${validated.scriptId}`);
          }
        }

        const { spawn } = require('node:child_process');

        const exePath = process.execPath;
        const args = process.argv.slice(1).filter((arg) => !arg.startsWith('--elevate-script'));

        if (validated.scriptId) {
          // Hand the elevated process the current id, so history and the audit
          // log record cpu-N rather than a retired alias.
          args.push('--elevate-script', resolveScriptId(validated.scriptId));
        }

        // Pass DNS parameters if provided
        if (validated.dnsInterfaceIndex && validated.dnsAddresses) {
          args.push(
            '--elevate-dns',
            validated.dnsInterfaceIndex.toString(),
            JSON.stringify(validated.dnsAddresses)
          );
        }

        // Use spawn with detached to properly elevate
        return new Promise((resolve, _reject) => {
          const elevated = spawn(
            'powershell.exe',
            [
              '-Command',
              `Start-Process -FilePath "${exePath}" -ArgumentList "${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}" -Verb RunAs -Wait`,
            ],
            {
              detached: true,
              stdio: 'ignore',
            }
          );

          elevated.unref();

          // Exit current non-elevated process after spawning elevated one
          setTimeout(() => {
            app.quit();
            resolve({ success: true });
          }, 500);
        });
      }
    )
  );
}
