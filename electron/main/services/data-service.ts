import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { app, safeStorage } from 'electron';
import type { AppSettings, ExecutionHistoryEntry, PageLockSettings } from '../../shared/ipc-types';
import { rewriteHistoryScriptIds } from '../legacy-script-ids';

interface UserData {
  customScripts: Array<{ name: string; content: string; extension: string }>;
  executionHistory: ExecutionHistoryEntry[];
}

const DEFAULT_PAGE_LOCK: PageLockSettings = {
  enabled: true,
  salt: '',
  passwordHashCipher: '',
  lockedPages: ['/emuladores'],
  unlocked: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: '#22d3ee',
  confirmOnExecute: true,
  autoRestorePoint: true,
  cpuVendorOverride: null,
  security: {
    enableIpcValidation: true,
    enableDenyListBlock: false,
    enablePathValidation: true,
    enablePsSanitize: true,
  },
  pageLock: DEFAULT_PAGE_LOCK,
  soundEnabled: true,
  toastDuration: 'medium',
};

function getDataDir(): string {
  return app.isPackaged
    ? resolve(app.getPath('appData'), 'fm-optimize')
    : resolve(__dirname, '../../data');
}

function getDataFilePath(): string {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'scripts_data.json');
}

function getSettingsFilePath(): string {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'settings.json');
}

export function loadUserData(): UserData {
  const filePath = getDataFilePath();
  if (!existsSync(filePath)) return { customScripts: [], executionHistory: [] };

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data: UserData = JSON.parse(raw);
    // One-shot: normalise any scriptId retired by the AMD/Intel catalog merge.
    // Runs on every launch, so the alias shim only has to outlive the first
    // start of this version rather than every version from here on.
    if (Array.isArray(data.executionHistory) && rewriteHistoryScriptIds(data.executionHistory)) {
      saveUserData(data);
    }
    return data;
  } catch {
    copyFileSync(filePath, `${filePath}.bak`);
    return { customScripts: [], executionHistory: [] };
  }
}

export function addHistoryEntry(entry: ExecutionHistoryEntry): void {
  const data = loadUserData();
  data.executionHistory.unshift(entry);
  if (data.executionHistory.length > 200) {
    data.executionHistory = data.executionHistory.slice(0, 200);
  }
  saveUserData(data);
}

export function saveUserData(data: UserData): void {
  const filePath = getDataFilePath();
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmpPath, filePath);
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsFilePath();
  if (!existsSync(filePath)) return DEFAULT_SETTINGS;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
    return {
      theme: ['light', 'dark', 'midnight', 'amber', 'emerald', 'batman'].includes(parsed.theme)
        ? parsed.theme
        : DEFAULT_SETTINGS.theme,
      accentColor:
        typeof parsed.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor)
          ? parsed.accentColor
          : DEFAULT_SETTINGS.accentColor,
      confirmOnExecute:
        typeof parsed.confirmOnExecute === 'boolean'
          ? parsed.confirmOnExecute
          : DEFAULT_SETTINGS.confirmOnExecute,
      autoRestorePoint:
        typeof parsed.autoRestorePoint === 'boolean'
          ? parsed.autoRestorePoint
          : DEFAULT_SETTINGS.autoRestorePoint,
      cpuVendorOverride:
        parsed.cpuVendorOverride === 'intel' || parsed.cpuVendorOverride === 'amd'
          ? parsed.cpuVendorOverride
          : DEFAULT_SETTINGS.cpuVendorOverride,
      security:
        parsed.security && typeof parsed.security === 'object'
          ? {
              enableIpcValidation:
                typeof parsed.security.enableIpcValidation === 'boolean'
                  ? parsed.security.enableIpcValidation
                  : DEFAULT_SETTINGS.security.enableIpcValidation,
              enableDenyListBlock:
                typeof parsed.security.enableDenyListBlock === 'boolean'
                  ? parsed.security.enableDenyListBlock
                  : DEFAULT_SETTINGS.security.enableDenyListBlock,
              enablePathValidation:
                typeof parsed.security.enablePathValidation === 'boolean'
                  ? parsed.security.enablePathValidation
                  : DEFAULT_SETTINGS.security.enablePathValidation,
              enablePsSanitize:
                typeof parsed.security.enablePsSanitize === 'boolean'
                  ? parsed.security.enablePsSanitize
                  : DEFAULT_SETTINGS.security.enablePsSanitize,
            }
          : DEFAULT_SETTINGS.security,
      pageLock:
        parsed.pageLock && typeof parsed.pageLock === 'object'
          ? {
              enabled:
                typeof parsed.pageLock.enabled === 'boolean'
                  ? parsed.pageLock.enabled
                  : DEFAULT_PAGE_LOCK.enabled,
              salt:
                typeof parsed.pageLock.salt === 'string'
                  ? parsed.pageLock.salt
                  : DEFAULT_PAGE_LOCK.salt,
              passwordHashCipher:
                typeof parsed.pageLock.passwordHashCipher === 'string'
                  ? decryptSecret(parsed.pageLock.passwordHashCipher)
                  : '',
              lockedPages: Array.isArray(parsed.pageLock.lockedPages)
                ? parsed.pageLock.lockedPages.filter((p: unknown) => typeof p === 'string')
                : DEFAULT_PAGE_LOCK.lockedPages,
              unlocked:
                typeof parsed.pageLock.unlocked === 'boolean'
                  ? parsed.pageLock.unlocked
                  : DEFAULT_PAGE_LOCK.unlocked,
            }
          : { ...DEFAULT_PAGE_LOCK },
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      toastDuration: ['short', 'medium', 'long'].includes(parsed.toastDuration)
        ? parsed.toastDuration
        : DEFAULT_SETTINGS.toastDuration,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function encryptSecret(plain: string): string {
  if (!plain || !safeStorage.isEncryptionAvailable()) return plain;
  return safeStorage.encryptString(plain).toString('base64');
}

function decryptSecret(cipher: string): string {
  if (!cipher || !safeStorage.isEncryptionAvailable()) return cipher;
  try {
    return safeStorage.decryptString(Buffer.from(cipher, 'base64'));
  } catch {
    return '';
  }
}

export function saveSettings(settings: AppSettings): void {
  const toSave: AppSettings = {
    ...settings,
    pageLock: {
      ...settings.pageLock,
      passwordHashCipher: safeStorage.isEncryptionAvailable()
        ? encryptSecret(settings.pageLock.passwordHashCipher)
        : settings.pageLock.passwordHashCipher,
    },
  };
  const filePath = getSettingsFilePath();
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(toSave, null, 2), 'utf-8');
  renameSync(tmpPath, filePath);
}
