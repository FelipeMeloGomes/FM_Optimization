import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import type {
  AdbApp,
  AdbChoosePathResult,
  AdbDevice,
  AppSettings,
  AutoCleanRunResult,
  AutoCleanStatus,
  BenchmarkResult,
  CleanerStats,
  CpuInfo,
  DashboardData,
  DownloadProgress,
  ElectronAPI,
  ElevatedLaunchResult,
  ExecutionHistoryEntry,
  ExportData,
  IpcResult,
  MemoryInfo,
  NetworkInfo,
  RemoveAppResult,
  RemovedApp,
  RestorePointEntry,
  ScriptEnded,
  ScriptEntry,
  SetPageLockPasswordResult,
  UpdateInfo,
  UpdateStatus,
} from '../shared/ipc-types';

function ipc<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args).then((r: unknown) => {
    const result = r as IpcResult<T>;
    if (!result.success) return Promise.reject(result.error);
    return result.data as T;
  });
}

function ipcVoid(channel: string, ...args: unknown[]): Promise<void> {
  return ipcRenderer.invoke(channel, ...args).then((r: unknown) => {
    const result = r as IpcResult;
    if (!result.success) return Promise.reject(new Error(result.error));
  });
}

const scriptEndedCallbacks = new Set<(data: ScriptEnded) => void>();
const updateStatusCallbacks = new Set<(data: UpdateStatus) => void>();
const updateInfoCallbacks = new Set<(data: UpdateInfo) => void>();
const downloadProgressCallbacks = new Set<(data: DownloadProgress) => void>();
const benchmarkProgressCallbacks = new Set<(data: { current: number; total: number }) => void>();
const benchmarkResultCallbacks = new Set<(data: BenchmarkResult) => void>();
const autoCleanStatusCallbacks = new Set<(status: AutoCleanStatus) => void>();
const autoCleanFinishedCallbacks = new Set<(result: AutoCleanRunResult) => void>();

function setupListeners(): void {
  ipcRenderer.on('script-ended', (_e: IpcRendererEvent, raw: string) => {
    try {
      const data = JSON.parse(raw) as ScriptEnded;
      scriptEndedCallbacks.forEach((cb) => {
        cb(data);
      });
    } catch {
      /* skip malformed ended */
    }
  });

  ipcRenderer.on('update-status', (_e: IpcRendererEvent, data: UpdateStatus) => {
    updateStatusCallbacks.forEach((cb) => {
      cb(data);
    });
  });

  ipcRenderer.on('update-info', (_e: IpcRendererEvent, data: UpdateInfo) => {
    updateInfoCallbacks.forEach((cb) => {
      cb(data);
    });
  });

  ipcRenderer.on('download-progress', (_e: IpcRendererEvent, data: DownloadProgress) => {
    downloadProgressCallbacks.forEach((cb) => {
      cb(data);
    });
  });

  ipcRenderer.on(
    'benchmark-progress',
    (_e: IpcRendererEvent, data: { current: number; total: number }) => {
      benchmarkProgressCallbacks.forEach((cb) => {
        cb(data);
      });
    }
  );

  ipcRenderer.on('benchmark-result', (_e: IpcRendererEvent, data: BenchmarkResult) => {
    benchmarkResultCallbacks.forEach((cb) => {
      cb(data);
    });
  });

  ipcRenderer.on('auto-clean-status', (_e: IpcRendererEvent, data: AutoCleanStatus) => {
    autoCleanStatusCallbacks.forEach((cb) => {
      cb(data);
    });
  });

  ipcRenderer.on('auto-clean-finished', (_e: IpcRendererEvent, data: AutoCleanRunResult) => {
    autoCleanFinishedCallbacks.forEach((cb) => {
      cb(data);
    });
  });
}

setupListeners();

const electronAPI: ElectronAPI = {
  getSystemInfo: () => ipc<DashboardData>('get-system-info'),
  getCpuInfo: () => ipc<CpuInfo>('get-cpu-info'),
  getMemoryInfo: () => ipc<MemoryInfo>('get-memory-info'),
  hasSSD: () => ipc<boolean>('has-ssd'),
  getScripts: () => ipc<ScriptEntry[]>('get-scripts'),
  executeScript: (id) => ipcVoid('execute-script', id),
  cancelExecution: (id) => ipcVoid('cancel-execution', id),
  getRestorePoints: () => ipc<RestorePointEntry[]>('get-restore-points'),
  createRestorePoint: (name) => ipcVoid('create-restore-point', name),
  deleteRestorePoint: (seq) => ipcVoid('delete-restore-point', seq),
  isAdmin: () => ipc<boolean>('is-admin'),
  getSettings: () => ipc<AppSettings>('get-settings'),
  saveSettings: (settings) => ipcVoid('save-settings', settings),
  verifyPageLockPassword: (payload) => ipc<boolean>('verify-page-lock-password', payload),
  setPageLockPassword: (payload) =>
    ipc<SetPageLockPasswordResult>('set-page-lock-password', payload),
  onScriptEnded: (cb: (data: ScriptEnded) => void) => {
    scriptEndedCallbacks.add(cb);
    return () => scriptEndedCallbacks.delete(cb);
  },
  getExecutionHistory: () => ipc<ExecutionHistoryEntry[]>('get-execution-history'),
  restoreSystem: (seq) => ipcVoid('restore-system', seq),
  getAppVersion: () => ipc<string>('get-app-version'),
  isPackaged: () => ipc<boolean>('is-packaged'),
  checkForUpdate: () => ipcVoid('check-for-update'),
  downloadUpdate: () => ipcVoid('download-update'),
  installUpdate: () => ipcVoid('install-update'),
  onUpdateStatus: (cb: (data: UpdateStatus) => void) => {
    updateStatusCallbacks.add(cb);
    return () => updateStatusCallbacks.delete(cb);
  },
  onUpdateInfo: (cb: (data: UpdateInfo) => void) => {
    updateInfoCallbacks.add(cb);
    return () => updateInfoCallbacks.delete(cb);
  },
  onDownloadProgress: (cb: (data: DownloadProgress) => void) => {
    downloadProgressCallbacks.add(cb);
    return () => downloadProgressCallbacks.delete(cb);
  },
  getNetworkInfo: () => ipc<NetworkInfo>('get-network-info'),
  onBenchmarkProgress: (cb: (data: { current: number; total: number }) => void) => {
    benchmarkProgressCallbacks.add(cb);
    return () => benchmarkProgressCallbacks.delete(cb);
  },
  onBenchmarkResult: (cb: (data: BenchmarkResult) => void) => {
    benchmarkResultCallbacks.add(cb);
    return () => benchmarkResultCallbacks.delete(cb);
  },
  benchmarkDns: (providers: { primary: string; secondary: string }[]) =>
    ipc<BenchmarkResult[]>('benchmark-dns', { providers }),
  applyDns: (interfaceIndex: number, addresses: string[]) =>
    ipcVoid('apply-dns', { interfaceIndex, addresses }),
  minimizeWindow: () => ipcVoid('window-minimize'),
  closeWindow: () => ipcVoid('window-close'),
  elevateApp: (
    scriptId?: string,
    dnsInterfaceIndex?: number,
    dnsAddresses?: string[],
    relaunch?: boolean
  ) =>
    ipc<ElevatedLaunchResult>('elevate-app', {
      scriptId,
      dnsInterfaceIndex,
      dnsAddresses,
      relaunch,
    }),
  getAutoCleanStatus: () => ipc<AutoCleanStatus>('get-auto-clean-status'),
  runCleanerNow: (cleanerIds: string[]) =>
    ipc<AutoCleanRunResult>('run-cleaner-now', { cleanerIds }),
  runAutoCleanPending: () => ipc<AutoCleanRunResult>('run-auto-clean-pending'),
  discardPendingCleaners: (cleanerIds: string[]) =>
    ipc<AutoCleanStatus>('discard-pending-cleaners', { cleanerIds }),
  onAutoCleanStatus: (cb: (status: AutoCleanStatus) => void) => {
    autoCleanStatusCallbacks.add(cb);
    return () => autoCleanStatusCallbacks.delete(cb);
  },
  onAutoCleanFinished: (cb: (result: AutoCleanRunResult) => void) => {
    autoCleanFinishedCallbacks.add(cb);
    return () => autoCleanFinishedCallbacks.delete(cb);
  },
  exportData: () => ipc<ExportData>('export-data'),
  importData: (jsonData: string) => ipc<{ success: boolean }>('import-data', jsonData),
  adbGetPath: () => ipc<string>('adb:get-path'),
  adbSetPath: (path: string) => ipcVoid('adb:set-path', { path }),
  adbChoosePath: () => ipc<AdbChoosePathResult>('adb:choose-path'),
  adbListDevices: () => ipc<AdbDevice[]>('adb:list-devices'),
  adbDetectEmulator: (emulatorId: string) =>
    ipc<{ installed: boolean; adbPath: string; version?: string }>('adb:detect-emulator', {
      emulatorId,
    }),
  adbListApps: (serial: string) => ipc<AdbApp[]>('adb:list-apps', { serial }),
  adbRemoveApp: (payload: {
    serial: string;
    instanceId: string;
    instanceName?: string;
    arch?: string;
    packageName: string;
  }) => ipc<RemoveAppResult>('adb:remove-app', payload),
  adbBackupApp: (payload: { serial: string; instanceId: string; packageName: string }) =>
    ipc<string>('adb:backup-app', payload),
  adbRestoreApp: (serial: string, apkPath: string) =>
    ipcVoid('adb:restore-app', { serial, apkPath }),
  adbRestoreAppByName: (payload: { serial: string; instanceId: string; packageName: string }) =>
    ipcVoid('adb:restore-app-by-name', payload),
  adbListRemovedApps: () => ipc<RemovedApp[]>('adb:list-removed'),
  adbRestoreRemovedApp: (payload: { serial: string; instanceId: string; packageName: string }) =>
    ipcVoid('adb:restore-removed', payload),
  adbClearRemoved: (packageName: string) => ipcVoid('adb:clear-removed', { packageName }),
  adbClearRemovedHistory: () => ipcVoid('adb:clear-removed-history'),
  adbListInstances: (emulatorId: string) =>
    ipc<{ id: string; name: string; arch: string; displayName?: string }[]>('adb:list-instances', {
      emulatorId,
    }),
  getCleanerStats: (cleanerId: string) => ipc<CleanerStats>('get-cleaner-stats', cleanerId),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
