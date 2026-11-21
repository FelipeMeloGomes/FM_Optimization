import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import type { DisplaySettings } from '../shared/display-settings';
import type {
  AdbApp,
  AdbChoosePathResult,
  AdbDevice,
  AppSettings,
  AppxInventory,
  AppxRemoveResult,
  AutoCleanRunResult,
  AutoCleanStatus,
  BenchmarkResult,
  CleanerItemStats,
  CleanItemsResult,
  CpuInfo,
  DashboardData,
  DownloadProgress,
  ElectronAPI,
  ElevatedLaunchResult,
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
  ExecutionHistoryEntry,
  ExportData,
  GpuCatalogEntry,
  GpuCatalogResult,
  IpcResult,
  MemoryInfo,
  NetworkInfo,
  RemoveAppResult,
  RemovedApp,
  RestorePointEntry,
  ScriptEnded,
  ScriptEntry,
  SetPageLockPasswordResult,
  SpeedProgress,
  SpeedTestResult,
  StartupSnapshot,
  UpdateInfo,
  UpdateStatus,
} from '../shared/ipc-types';
import type { KeyboardSettings } from '../shared/keyboard-settings';
import type { MouseSettings } from '../shared/mouse-settings';
import type {
  AddOverlayGameInput,
  GameDisplayModeInfo,
  OverlayGame,
  OverlaySettings,
  OverlayStatus,
  SetOverlayGameEnabledInput,
} from '../shared/overlay-types';

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
const speedProgressCallbacks = new Set<(data: SpeedProgress) => void>();
const autoCleanStatusCallbacks = new Set<(status: AutoCleanStatus) => void>();
const autoCleanFinishedCallbacks = new Set<(result: AutoCleanRunResult) => void>();
const essentialInstallCallbacks = new Set<(data: EssentialInstallProgress) => void>();
const overlayStatusCallbacks = new Set<(status: OverlayStatus) => void>();

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

  ipcRenderer.on('speed-progress', (_e: IpcRendererEvent, data: SpeedProgress) => {
    speedProgressCallbacks.forEach((cb) => {
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

  ipcRenderer.on(
    'essential-install-progress',
    (_e: IpcRendererEvent, data: EssentialInstallProgress) => {
      essentialInstallCallbacks.forEach((cb) => {
        cb(data);
      });
    }
  );

  ipcRenderer.on('overlay:status', (_e: IpcRendererEvent, data: OverlayStatus) => {
    overlayStatusCallbacks.forEach((cb) => {
      cb(data);
    });
  });
}

setupListeners();

const electronAPI: ElectronAPI = {
  getSystemInfo: () => ipc<DashboardData>('get-system-info'),
  getSystemInfoCache: () =>
    ipc<{ version: number; timestamp: string; data: DashboardData } | null>(
      'get-system-info-cache'
    ),
  getGpuCatalog: () => ipc<GpuCatalogResult>('get-gpu-catalog'),
  searchGpu: (name) => ipc<GpuCatalogEntry | null>('search-gpu', name),
  getCpuInfo: () => ipc<CpuInfo>('get-cpu-info'),
  getMemoryInfo: () => ipc<MemoryInfo>('get-memory-info'),
  hasSSD: () => ipc<boolean>('has-ssd'),
  runDiskCleanup: (letter) => ipcVoid('storage:clean-drive', letter),
  optimizeDrive: (letter) => ipcVoid('storage:optimize-drive', letter),
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
  measureSpeed: () => ipc<SpeedTestResult>('measure-speed'),
  cancelSpeedTest: () => ipcVoid('cancel-speed-test'),
  onSpeedProgress: (cb: (data: SpeedProgress) => void) => {
    speedProgressCallbacks.add(cb);
    return () => speedProgressCallbacks.delete(cb);
  },
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
  adbListRemovedApps: () => ipc<RemovedApp[]>('adb:list-removed'),
  adbRestoreRemovedApp: (payload: { serial: string; instanceId: string; packageName: string }) =>
    ipcVoid('adb:restore-removed', payload),
  adbClearRemoved: (packageName: string) => ipcVoid('adb:clear-removed', { packageName }),
  adbClearRemovedHistory: () => ipcVoid('adb:clear-removed-history'),
  adbListInstances: (emulatorId: string) =>
    ipc<{ id: string; name: string; arch: string; displayName?: string }[]>('adb:list-instances', {
      emulatorId,
    }),
  getCleanerItemsStats: () => ipc<CleanerItemStats[]>('get-cleaner-items-stats'),
  cleanItems: (ids: string[]) => ipc<CleanItemsResult>('clean-items', { ids }),
  getAppxInventory: (refresh?: boolean) => ipc<AppxInventory>('appx:get-inventory', refresh),
  removeAppxPackages: (families: string[]) => ipc<AppxRemoveResult>('appx:remove', { families }),
  getEssentials: () => ipc<EssentialListItem[]>('essentials:list'),
  openEssentialPage: (id) => ipcVoid('essentials:open-page', id),
  installEssential: (id) => ipc<EssentialInstallResult>('essentials:install', id),
  cancelEssentialInstall: (id) => ipcVoid('essentials:cancel-install', id),
  onEssentialInstallProgress: (cb: (data: EssentialInstallProgress) => void) => {
    essentialInstallCallbacks.add(cb);
    return () => essentialInstallCallbacks.delete(cb);
  },
  startupList: () => ipc<StartupSnapshot>('startup:list'),
  startupSetEnabled: (payload) => ipc<StartupSnapshot>('startup:set-enabled', payload),
  startupOpenLocation: (payload) => ipcVoid('startup:open-location', payload),
  startupStopService: (payload) => ipc<StartupSnapshot>('startup:stop-service', payload),
  getMouseSettings: () => ipc<MouseSettings>('mouse:get-settings'),
  applyMouseSettings: (settings) => ipc<MouseSettings>('mouse:apply-settings', settings),
  getDisplaySettings: () => ipc<DisplaySettings>('display:get-settings'),
  applyDisplaySettings: (mode) => ipc<DisplaySettings>('display:apply-settings', mode),
  getKeyboardSettings: () => ipc<KeyboardSettings>('keyboard:get-settings'),
  applyKeyboardSettings: (settings) => ipc<KeyboardSettings>('keyboard:apply-settings', settings),
  getOverlayGames: () => ipc<OverlayGame[]>('get-overlay-games'),
  addOverlayGame: (input: AddOverlayGameInput) => ipc<OverlayGame>('add-overlay-game', input),
  removeOverlayGame: (id: string) => ipcVoid('remove-overlay-game', id),
  setOverlayGameEnabled: (input: SetOverlayGameEnabledInput) =>
    ipcVoid('set-overlay-game-enabled', input),
  getOverlaySettings: () => ipc<OverlaySettings>('get-overlay-settings'),
  saveOverlaySettings: (settings: OverlaySettings) => ipcVoid('save-overlay-settings', settings),
  getOverlayStatus: () => ipc<OverlayStatus>('get-overlay-status'),
  startOverlayMonitor: () => ipcVoid('start-overlay-monitor'),
  stopOverlayMonitor: () => ipcVoid('stop-overlay-monitor'),
  restartOverlayElevated: () => ipcVoid('restart-overlay-elevated'),
  chooseOverlayExe: () => ipc<AddOverlayGameInput | null>('choose-overlay-exe'),
  launchOverlayGame: (id: string) => ipcVoid('launch-overlay-game', id),
  getOverlayCover: (fileName: string) => ipc<string | null>('get-overlay-cover', fileName),
  getGameDisplayMode: (gameId: string) => ipc<GameDisplayModeInfo>('get-game-display-mode', gameId),
  setGameBorderless: (gameId: string) => ipc<GameDisplayModeInfo>('set-game-borderless', gameId),
  onOverlayStatus: (cb: (status: OverlayStatus) => void) => {
    overlayStatusCallbacks.add(cb);
    return () => {
      overlayStatusCallbacks.delete(cb);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
