export type CpuVendor = 'intel' | 'amd' | 'unknown';

export interface CpuInfo {
  model: string;
  manufacturer: string;
  vendor: CpuVendor;
  cores: number;
  logicalProcessors: number;
  architecture: string;
  usage: number;
}

export interface GpuInfo {
  name: string;
  vram: string;
  driverVersion: string;
  usage: number;
}

export interface MemoryInfo {
  total: string;
  used: string;
  free: string;
  type: string;
  slots: number;
  frequency: string;
}

export interface OsInfo {
  name: string;
  version: string;
  build: string;
  edition: string;
  installDate: string;
}

export interface StorageDrive {
  letter: string;
  label: string;
  size: string;
  free: string;
  usedPercent: number;
  type: string;
}

export interface DashboardData {
  cpu: CpuInfo;
  gpu: GpuInfo;
  memory: MemoryInfo;
  os: OsInfo;
  drives: StorageDrive[];
  uptime: number;
}

export interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  content: string;
  extension: 'bat' | 'ps1' | 'reg' | 'exe' | 'cmd';
  requiresAdmin: boolean;
  requiresRestart?: boolean;
  interactive?: boolean;
  isBuiltIn: boolean;
  tags: string[];
  guide?: string;
  riskLevel?: 'safe' | 'moderate' | 'deep';
}

export interface RestorePointEntry {
  sequenceNumber: number;
  description: string;
  creationTime: string;
  eventType: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'midnight' | 'amber' | 'emerald' | 'batman';
  accentColor: string;
  confirmOnExecute: boolean;
  autoRestorePoint: boolean;
  cpuVendorOverride: CpuVendor | null;
  security: SecuritySettings;
  pageLock: PageLockSettings;
  soundEnabled: boolean;
  toastDuration: 'short' | 'medium' | 'long';
}

export interface SecuritySettings {
  enableIpcValidation: boolean;
  enableDenyListBlock: boolean;
  enablePathValidation: boolean;
  enablePsSanitize: boolean;
}

export interface PageLockSettings {
  enabled: boolean;
  salt: string;
  passwordHashCipher: string;
  lockedPages: string[];
  unlocked: boolean;
}

export interface VerifyPageLockPasswordPayload {
  password: string;
}

export interface SetPageLockPasswordPayload {
  password: string;
}

export interface SetPageLockPasswordResult {
  salt: string;
  passwordHashCipher: string;
}

export interface ScriptEnded {
  id: string;
  code: number | null;
  scriptName?: string;
}

export interface ExecutionHistoryEntry {
  id: string;
  scriptId: string;
  scriptName: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  exitCode: number | null;
  wasCancelled: boolean;
}

export type UpdateStatus =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface NetworkInfo {
  interfaceName: string;
  interfaceIndex: number;
  currentDns: string[];
}

export interface BenchmarkResult {
  address: string;
  latencyMs: number | null;
}

export interface AdbDevice {
  serial: string;
  state: 'device' | 'offline' | 'unauthorized';
  model?: string;
  emulator?: string;
}

export interface AdbApp {
  packageName: string;
  label: string;
  isSystem: boolean;
  isDisabled: boolean;
  isUpdated: boolean;
}

export type RemoveMode = 'uninstalled' | 'disabled';

export interface RemoveAppResult {
  mode: RemoveMode;
}

export interface RemovedApp {
  packageName: string;
  label: string;
  instanceId: string;
  instanceName: string;
  arch: string;
  removedAt: string;
  mode: RemoveMode;
  hasBackup: boolean;
}

export interface AdbConfig {
  adbPath: string;
}

export interface AdbEmulatorResult {
  installed: boolean;
  adbPath: string;
  version?: string;
}

export interface AdbInstance {
  id: string;
  name: string;
  arch: string;
  displayName?: string;
}

export interface CleanerCategoryStats {
  label: string;
  fileCount: number;
  totalSizeBytes: number;
}

export interface CleanerStats {
  fileCount: number;
  totalSizeBytes: number;
  estimatedSeconds: number;
  categories: CleanerCategoryStats[];
  error?: boolean;
}

export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  settings?: Partial<AppSettings>;
  history?: ExecutionHistoryEntry[];
}

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: T };

export interface ElectronAPI {
  getSystemInfo(): Promise<DashboardData>;
  getCpuInfo(): Promise<CpuInfo>;
  getMemoryInfo(): Promise<MemoryInfo>;
  hasSSD(): Promise<boolean>;
  getScripts(): Promise<ScriptEntry[]>;
  executeScript(id: string): Promise<void>;
  cancelExecution(id: string): Promise<void>;
  getRestorePoints(): Promise<RestorePointEntry[]>;
  createRestorePoint(name: string): Promise<void>;
  deleteRestorePoint(seq: number): Promise<void>;
  isAdmin(): Promise<boolean>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  verifyPageLockPassword(payload: VerifyPageLockPasswordPayload): Promise<boolean>;
  setPageLockPassword(payload: SetPageLockPasswordPayload): Promise<SetPageLockPasswordResult>;
  onScriptEnded(cb: (data: ScriptEnded) => void): () => void;
  restoreSystem(seq: number): Promise<void>;
  getAppVersion(): Promise<string>;
  isPackaged(): Promise<boolean>;
  checkForUpdate(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(cb: (data: UpdateStatus) => void): () => void;
  onUpdateInfo(cb: (data: UpdateInfo) => void): () => void;
  getExecutionHistory(): Promise<ExecutionHistoryEntry[]>;
  onDownloadProgress(cb: (data: DownloadProgress) => void): () => void;
  onBenchmarkProgress(cb: (data: { current: number; total: number }) => void): () => void;
  onBenchmarkResult(cb: (data: BenchmarkResult) => void): () => void;
  getNetworkInfo(): Promise<NetworkInfo>;
  benchmarkDns(providers: { primary: string; secondary: string }[]): Promise<BenchmarkResult[]>;
  applyDns(interfaceIndex: number, addresses: string[]): Promise<void>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  elevateApp(scriptId?: string, dnsInterfaceIndex?: number, dnsAddresses?: string[]): Promise<void>;
  exportData(): Promise<ExportData>;
  importData(jsonData: string): Promise<{ success: boolean }>;
  adbGetPath(): Promise<string>;
  adbSetPath(path: string): Promise<void>;
  adbListDevices(): Promise<AdbDevice[]>;
  adbDetectEmulator(emulatorId: string): Promise<AdbEmulatorResult>;
  adbListApps(serial: string): Promise<AdbApp[]>;
  adbRemoveApp(payload: {
    serial: string;
    instanceId: string;
    instanceName?: string;
    arch?: string;
    packageName: string;
  }): Promise<RemoveAppResult>;
  adbBackupApp(payload: {
    serial: string;
    instanceId: string;
    packageName: string;
  }): Promise<string>;
  adbRestoreApp(serial: string, apkPath: string): Promise<void>;
  adbRestoreAppByName(payload: {
    serial: string;
    instanceId: string;
    packageName: string;
  }): Promise<void>;
  adbListRemovedApps(): Promise<RemovedApp[]>;
  adbRestoreRemovedApp(payload: {
    serial: string;
    instanceId: string;
    packageName: string;
  }): Promise<void>;
  adbClearRemoved(packageName: string): Promise<void>;
  adbClearRemovedHistory(): Promise<void>;
  adbListInstances(emulatorId: string): Promise<AdbInstance[]>;
  getCleanerStats(cleanerId: string): Promise<CleanerStats>;
}
