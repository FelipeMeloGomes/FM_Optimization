import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { app } from 'electron';
import type {
  AdbApp,
  AdbDevice,
  AdbInstance,
  RemovedApp,
  RemoveMode,
} from '../../shared/ipc-types';
import { formatError, logger } from '../utils/logger';
import {
  createRemovedAppsStore,
  type RemovedAppRecord,
  type RemovedAppsStore,
} from './removed-apps';

let adbPath = '';

const APP_LABELS: Record<string, string> = {
  // Facebook
  'com.facebook.katana': 'Facebook',
  'com.facebook.appmanager': 'Facebook App Manager',
  'com.facebook.services': 'Facebook Services',
  'com.facebook.system': 'Facebook System',
  'com.facebook.orca': 'Messenger',
  'com.facebook.lite': 'Facebook Lite',
  // Instagram
  'com.instagram.android': 'Instagram',
  'com.instagram.lite': 'Instagram Lite',
  // Twitter/X
  'com.twitter.android': 'Twitter',
  // TikTok
  'com.tiktok.android': 'TikTok',
  'com.zhiliaoapp.musically': 'TikTok',
  // Snapchat
  'com.snapchat.android': 'Snapchat',
  // LinkedIn
  'com.linkedin.android': 'LinkedIn',
  // Pinterest
  'com.pinterest': 'Pinterest',
  // Microsoft
  'com.microsoft.skydrive': 'OneDrive',
  'com.microsoft.office.outlook': 'Outlook',
  'com.microsoft.teams': 'Teams',
  'com.microsoft.office.word': 'Word',
  'com.microsoft.office.excel': 'Excel',
  'com.microsoft.office.powerpoint': 'PowerPoint',
  'com.microsoft.office.onenote': 'OneNote',
  'com.officemobile': 'Office Mobile',
  'com.microsoft.emmx': 'Edge',
  // Spotify
  'com.spotify.music': 'Spotify',
  // Netflix
  'com.netflix.mediaclient': 'Netflix',
  // Amazon
  'com.amazon.mShop.android.shopping': 'Amazon',
  'com.amazon.appmanager': 'Amazon App Manager',
  'com.amazon.ags.app': 'Amazon Games',
  'com.amazon.avod': 'Prime Video',
  'com.amazon.dee.app': 'Alexa',
  // eBay
  'com.ebay.mobile': 'eBay',
  // PayPal
  'com.paypal.android.p2pmobile': 'PayPal',
  // Games
  'com.king.candycrushsaga': 'Candy Crush',
  'com.king.candycrushsodasaga': 'Candy Crush Soda',
  'com.supercell.clashofclans': 'Clash of Clans',
  'com.supercell.clashroyale': 'Clash Royale',
  'com.supercell.brawlstars': 'Brawl Stars',
  'com.epicgames.fortnite': 'Fortnite',
  // Google
  'com.google.android.gms': 'Google Play Services',
  'com.google.android.gmsquick': 'Google Play Services',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.youtube': 'YouTube',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.google.android.apps.docs': 'Google Drive',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.apps.chromecast.app': 'Google Home',
  'com.google.android.apps.nexuslauncher': 'Pixel Launcher',
  'com.google.android.inputmethod.latin': 'Gboard',
  'com.google.android.googlequicksearchbox': 'Google',
  'com.google.android.apps.walletnfcrel': 'Google Wallet',
  'com.google.android.calendar': 'Google Calendar',
  'com.google.android.contacts': 'Google Contacts',
  'com.google.android.dialer': 'Google Phone',
  'com.google.android.apps.messaging': 'Google Messages',
  'com.google.android.marvin.talkback': 'TalkBack',
  'com.google.android.accessibility.switchaccess': 'Switch Access',
  'com.google.android.projection.gearhead': 'Android Auto',
  // Samsung
  'com.sec.android.app.sbrowser': 'Samsung Internet',
  'com.samsung.android.calculator': 'Calculator',
  'com.samsung.android.calendar': 'Calendar',
  'com.samsung.android.camera': 'Camera',
  'com.samsung.android.app.tips': 'Tips',
  'com.samsung.android.visionintelligence': 'Bixby Vision',
  'com.samsung.android.bixby.agent': 'Bixby',
  'com.samsung.android.game.gamehome': 'Game Launcher',
  'com.sec.android.app.shealth': 'Samsung Health',
  // Xiaomi/MIUI
  'com.miui.home': 'MIUI Home',
  'com.miui.securitycenter': 'Security',
  'com.miui.gallery': 'Gallery',
  'com.miui.calculator': 'Calculator',
  'com.miui.cleaner': 'Cleaner',
  'com.miui.weather2': 'Weather',
  'com.miui.mishare.connectivity': 'Mi Share',
  // Communication
  'com.whatsapp': 'WhatsApp',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'org.telegram.messenger': 'Telegram',
  'org.thoughtcrime.securesms': 'Signal',
  'com.viber.voip': 'Viber',
  'jp.naver.line.android': 'LINE',
  'com.discord': 'Discord',
  'com.skype.raider': 'Skype',
  'com.icq': 'ICQ',
  // Browsers
  'org.mozilla.firefox': 'Firefox',
  'com.UCMobile.intl': 'UC Browser',
  'com.opera.browser': 'Opera',
  'com.opera.mini.native': 'Opera Mini',
  'com.brave.browser': 'Brave',
  // Utilities
  'com.duolingo': 'Duolingo',
  'com.shazam.android': 'Shazam',
  'com.accuweather.android': 'AccuWeather',
  'com.borderfree': 'Borderfree',
  'com.ubercab': 'Uber',
  'com.grabtaxi.driver': 'Grab Driver',
  'com.grabtaxi.passenger': 'Grab',
  'com.kakao.taxi': 'Kakao Taxi',
  // Android System
  'com.android.vending': 'Google Play Store',
  'com.android.settings': 'Settings',
  'com.android.systemui': 'System UI',
  'com.android.phone': 'Phone',
  'com.android.contacts': 'Contacts',
  'com.android.mms': 'Messages',
  'com.android.dialer': 'Dialer',
  'com.android.launcher': 'Launcher',
  'com.android.launcher3': 'Launcher',
  'com.android.providers.storage': 'Storage',
  'com.android.server.telecom': 'Telecom',
  'com.android.bluetooth': 'Bluetooth',
  'com.android.nfc': 'NFC',
  'com.android.certinstaller': 'Certificate Installer',
  'com.android.chrome': 'Chrome',
  'com.android.camera': 'Camera',
  'com.android.gallery3d': 'Gallery',
  'com.android.calendar': 'Calendar',
  'com.android.deskclock': 'Clock',
  'com.android.calculator2': 'Calculator',
  'com.android.email': 'Email',
  'com.android.filemanager': 'File Manager',
  'com.android.inputmethod.latin': 'Keyboard',
  'com.android.music': 'Music',
  'com.android.soundrecorder': 'Sound Recorder',
  'com.android.term': 'Terminal',
  'com.android.webview': 'WebView',
  'com.android.packageinstaller': 'Package Installer',
  'com.android.stk': 'SIM Toolkit',
  'com.android.wallpaper.live': 'Live Wallpaper',
  'com.android.providers.downloads': 'Downloads',
  'com.android.providers.downloads.ui': 'Downloads UI',
  'com.android.providers.media': 'Media Storage',
  'com.android.providers.userdictionary': 'User Dictionary',
  'com.android.quicksearchbox': 'Quick Search Box',
  'com.android.se': 'Secure Element',
  'com.android.shell': 'Shell',
  'com.android.traceur': 'System Tracing',
  'com.android.wallpapercropper': 'Wallpaper Cropper',
};

const EMULATOR_ADB_PATHS: Record<string, string[]> = {
  'bluestacks-4': [
    'C:\\Program Files (x86)\\BlueStacks\\HD-Adb.exe',
    'C:\\Program Files\\BlueStacks\\HD-Adb.exe',
  ],
  'bluestacks-5': [
    'C:\\Program Files\\BlueStacks_msi5\\HD-Adb.exe',
    resolve(process.env.PROGRAMFILES || '', 'BlueStacks_nxt\\HD-Adb.exe'),
    'C:\\Program Files (x86)\\BlueStacks_msi5\\HD-Adb.exe',
  ],
};

const versionCache = new Map<string, string>();

const EMULATOR_CONF_PATHS: Record<string, string[]> = {
  'bluestacks-4': [
    'C:\\ProgramData\\BlueStacks\\bluestacks.conf',
    'C:\\Program Files (x86)\\BlueStacks\\bluestacks.conf',
  ],
  'bluestacks-5': [
    'C:\\ProgramData\\BlueStacks_msi5\\bluestacks.conf',
    resolve(process.env.PROGRAMDATA || '', 'BlueStacks_nxt\\bluestacks.conf'),
  ],
};

function detectAdbPath(): string {
  const candidates = [
    resolve(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe'),
    'C:\\Program Files\\BlueStacks_msi5\\HD-Adb.exe',
    'C:\\Program Files (x86)\\BlueStacks\\HD-Adb.exe',
    resolve(process.env.PROGRAMFILES || '', 'BlueStacks_nxt\\HD-Adb.exe'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return 'adb';
}

export function detectEmulatorAdbPath(emulatorId: string): { installed: boolean; adbPath: string } {
  const candidates = EMULATOR_ADB_PATHS[emulatorId];
  if (!candidates) return { installed: false, adbPath: '' };
  for (const p of candidates) {
    if (existsSync(p)) return { installed: true, adbPath: p };
  }
  return { installed: false, adbPath: '' };
}

export async function detectEmulatorVersion(emulatorId: string): Promise<string | null> {
  // Verificar cache primeiro
  const cached = versionCache.get(emulatorId);
  if (cached) {
    logger.debug('[detectEmulatorVersion] Cache hit', { emulatorId, version: cached });
    return cached;
  }

  // Primeiro: tentar obter a versão do executável principal do emulador (HD-Player.exe)
  const playerPaths: Record<string, string[]> = {
    'bluestacks-4': [
      'C:\\Program Files (x86)\\BlueStacks\\HD-Player.exe',
      'C:\\Program Files\\BlueStacks\\HD-Player.exe',
    ],
    'bluestacks-5': [
      'C:\\Program Files\\BlueStacks_msi5\\HD-Player.exe',
      resolve(process.env.PROGRAMFILES || '', 'BlueStacks_nxt\\HD-Player.exe'),
      'C:\\Program Files (x86)\\BlueStacks_msi5\\HD-Player.exe',
    ],
  };

  const allowedPaths = playerPaths[emulatorId] || [];
  if (allowedPaths.length > 0) {
    for (const p of allowedPaths) {
      logger.debug('[detectEmulatorVersion] Checking path', { path: p });
      if (existsSync(p)) {
        logger.debug('[detectEmulatorVersion] File exists', { path: p });
        try {
          const psCmd = `(Get-Item -LiteralPath '${p}').VersionInfo.ProductVersion`;
          logger.debug('[detectEmulatorVersion] Running PS', { command: psCmd });

          const output = await new Promise<string>((resolve, reject) => {
            execFile(
              'powershell',
              ['-NoProfile', '-Command', psCmd],
              {
                encoding: 'utf-8',
                timeout: 5000,
              },
              (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout.trim());
              }
            );
          });

          const full = output.trim();
          logger.debug('[detectEmulatorVersion] PS Output', { output: full });
          if (full) {
            const parts = full.split('.');
            const result = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : full;
            logger.info('[detectEmulatorVersion] Version detected', {
              emulatorId,
              version: result,
            });
            versionCache.set(emulatorId, result);
            return result;
          }
        } catch (e: unknown) {
          logger.error('[detectEmulatorVersion] Error', {
            emulatorId,
            path: p,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        logger.debug('[detectEmulatorVersion] File NOT found', { path: p });
      }
    }
  }

  // Fallback: bluestacks.conf (launcher_version)
  logger.debug('[detectEmulatorVersion] Falling back to conf', { emulatorId });
  const confCandidates = EMULATOR_CONF_PATHS[emulatorId];
  if (confCandidates) {
    for (const p of confCandidates) {
      if (existsSync(p)) {
        try {
          const content = readFileSync(p, 'utf-8');
          let match = content.match(/^bst\.launcher_version\s*=\s*["']?([^"'\r\n]+)["']?/m);
          if (!match) {
            match = content.match(/^bst\.version\s*=\s*["']?([^"'\r\n]+)["']?/m);
          }
          if (match?.[1]) {
            const full = match[1].trim();
            const parts = full.split('.');
            const result = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : full;
            versionCache.set(emulatorId, result);
            return result;
          }
        } catch (e: unknown) {
          logger.warn('[detectEmulatorVersion] Conf parse error', {
            emulatorId,
            path: p,
            error: formatError(e),
          });
        }
      }
    }
  }

  return null;
}

export function listEmulatorInstances(emulatorId: string): AdbInstance[] {
  logger.debug('[ADB] listEmulatorInstances called', { emulatorId });
  const confCandidates = EMULATOR_CONF_PATHS[emulatorId];
  if (!confCandidates) {
    logger.warn('[ADB] No conf paths for emulatorId', { emulatorId });
    return [];
  }

  let confPath = '';
  for (const p of confCandidates) {
    if (existsSync(p)) {
      confPath = p;
      break;
    }
  }
  if (!confPath) {
    logger.warn('[ADB] No conf file found', { candidates: confCandidates.join(', ') });
    return [];
  }
  logger.debug('[ADB] Using conf', { path: confPath });

  let content: string;
  try {
    content = readFileSync(confPath, 'utf-8');
  } catch (e: unknown) {
    logger.error('[ADB] Failed to read conf', { error: formatError(e) });
    return [];
  }

  const instanceNames = new Set<string>();
  const instanceRegex = /^bst\.instance\.([^.]+)\./gm;
  let match = instanceRegex.exec(content);
  while (match) {
    instanceNames.add(match[1]);
    match = instanceRegex.exec(content);
  }

  logger.debug('[ADB] Found instances', { instances: [...instanceNames].join(', ') });

  return Array.from(instanceNames).map((name) => {
    const is64 = name.toLowerCase().includes('64');
    const arch = is64 ? '64-bit' : '32-bit';
    const dnRe = new RegExp(`^bst\\.instance\\.${name}\\.display_name="([^"]*)"`, 'm');
    const displayMatch = content.match(dnRe);
    return {
      id: name.toLowerCase().replace(/([a-z])(\d)/, '$1-$2'),
      name,
      arch,
      displayName: displayMatch?.[1] || undefined,
    };
  });
}

export function initAdbPath(): string {
  if (!adbPath) adbPath = detectAdbPath();
  return adbPath;
}

export function setAdbPath(path: string): void {
  adbPath = path;
}

export function getAdbPath(): string {
  if (!adbPath) adbPath = detectAdbPath();
  return adbPath;
}

export interface AdbExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function execAdbResult(args: string[], timeoutMs = 120_000): Promise<AdbExecResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(adbPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      resolvePromise({ code: null, stdout: '', stderr: `Failed to spawn adb: ${err.message}` });
    });
  });
}

export function execAdb(args: string[], timeoutMs?: number): Promise<string> {
  return execAdbResult(args, timeoutMs).then(({ code, stdout, stderr }) => {
    if (code !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || `adb exited with code ${code}`);
    }
    return stdout;
  });
}

export interface PmResult {
  ok: boolean;
  reason?: string;
}

export function parsePmResult(output: string): PmResult {
  const text = output.trim();
  if (!text) return { ok: true };
  const failureMatch = text.match(/^Failure\s+\[?(.*?)\]?\s*$/i);
  if (failureMatch) {
    return { ok: false, reason: failureMatch[1]?.trim() || 'erro desconhecido' };
  }
  return { ok: true };
}

export function pmCommandSucceeded(result: AdbExecResult): PmResult {
  const parsed = parsePmResult(result.stdout);
  if (!parsed.ok) return parsed;
  if (result.code !== 0) {
    return {
      ok: false,
      reason: result.stderr.trim() || `adb exited with code ${result.code}`,
    };
  }
  return { ok: true };
}

export async function listDevices(): Promise<AdbDevice[]> {
  const output = await execAdb(['devices', '-l']);
  const lines = output
    .split('\n')
    .slice(1)
    .filter((l) => l.trim());

  const devices: AdbDevice[] = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const serial = parts[0];
    const state = parts[1] as AdbDevice['state'];
    if (!['device', 'offline', 'unauthorized'].includes(state)) continue;

    const device: AdbDevice = { serial, state };

    const modelMatch = line.match(/model:(\S+)/);
    if (modelMatch) device.model = modelMatch[1];

    const emulatorMatch = line.match(/emulator-(\d+)/);
    if (emulatorMatch) device.emulator = emulatorMatch[1];

    devices.push(device);
  }

  return devices;
}

function sanitizeInstanceId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getAppDataDir(): string {
  return app.isPackaged
    ? resolve(app.getPath('appData'), 'fm-optimize')
    : resolve(__dirname, '../../data');
}

function getBackupDir(instanceId?: string): string {
  const base = resolve(getAppDataDir(), 'backups');
  const dir = instanceId ? resolve(base, sanitizeInstanceId(instanceId)) : base;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

let removedAppsStore: RemovedAppsStore | null = null;

function getRemovedAppsStore(): RemovedAppsStore {
  removedAppsStore ??= createRemovedAppsStore(getAppDataDir());
  return removedAppsStore;
}

function listBackupFiles(dir: string, packageName: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f === `${packageName}.apk` || f.startsWith(`${packageName}.`))
    .map((f) => resolve(dir, f));
}

function deleteBackupFiles(dir: string, packageName: string): void {
  for (const f of listBackupFiles(dir, packageName)) {
    try {
      unlinkSync(f);
    } catch {
      /* best effort */
    }
  }
}

function cleanSegment(raw: string): string {
  let label = raw
    .replace(/versionCode:\S+/g, '')
    .replace(/versionName:\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (label.length > 40) label = label.substring(0, 40);
  return label;
}

export function resolveLabel(packageName: string): string {
  if (APP_LABELS[packageName]) return APP_LABELS[packageName];
  const segments = packageName.split('.');
  const last = segments[segments.length - 1];
  return cleanSegment(last.charAt(0).toUpperCase() + last.slice(1));
}

export function parsePackagePaths(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('package:'))
    .map((l) => l.replace('package:', ''));
}

export function parseCodePathLines(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('codePath='))
    .map((l) => l.replace('codePath=', ''));
}

export function resolveBackupPaths(pmPaths: string[], codePaths: string[]): string[] {
  const direct = pmPaths.filter(Boolean);
  if (direct.length > 0) return direct;
  const fromCodePaths = codePaths
    .filter(Boolean)
    .map((cp) => (cp.endsWith('.apk') ? cp : `${cp}/base.apk`));
  return [...new Set(fromCodePaths)];
}

export function buildInstallArgs(files: string[]): string[] {
  return files.length > 1 ? ['install-multiple', '-r', ...files] : ['install', '-r', ...files];
}

export async function listApps(serial: string): Promise<AdbApp[]> {
  const [packagesOutput, disabledOutput] = await Promise.all([
    execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '-f']),
    execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '-d']).catch(() => ''),
  ]);

  const disabledPackages = new Set(
    disabledOutput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('package:'))
      .map((l) => l.replace('package:', ''))
  );

  const parsed = packagesOutput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('package:'))
    .map((line) => {
      const withoutPrefix = line.replace('package:', '');
      const eqIndex = withoutPrefix.lastIndexOf('=');
      const apkPath = eqIndex > -1 ? withoutPrefix.substring(0, eqIndex) : withoutPrefix;
      const packageName = eqIndex > -1 ? withoutPrefix.substring(eqIndex + 1) : '';
      const isSystem = apkPath.startsWith('/system/') || apkPath.startsWith('/vendor/');
      const isUpdated = apkPath.startsWith('/data/');

      return {
        packageName,
        apkPath,
        isSystem,
        isDisabled: disabledPackages.has(packageName),
        isUpdated,
      };
    })
    .filter((p) => p.packageName);

  return parsed.map((pkg) => ({
    packageName: pkg.packageName,
    label: resolveLabel(pkg.packageName),
    isSystem: pkg.isSystem,
    isDisabled: pkg.isDisabled,
    isUpdated: pkg.isUpdated,
  }));
}

export interface RemoveAppContext {
  serial: string;
  instanceId: string;
  instanceName: string;
  arch: string;
  packageName: string;
}

export interface RemoveAppDeps {
  execResult: (args: string[]) => Promise<AdbExecResult>;
  backupApp: () => Promise<string | null>;
  record: (record: RemovedAppRecord) => void;
  deleteBackups: () => void;
}

export async function removeAppFlow(
  deps: RemoveAppDeps,
  ctx: RemoveAppContext
): Promise<{ mode: RemoveMode; hasBackup: boolean }> {
  const { serial, packageName } = ctx;

  let backupPath: string | null = null;
  try {
    backupPath = await deps.backupApp();
  } catch (e: unknown) {
    logger.warn('[removeApp] backup falhou', { packageName, error: formatError(e) });
    backupPath = null;
  }

  const record = (mode: RemoveMode): void => {
    deps.record({
      packageName,
      label: resolveLabel(packageName),
      instanceId: ctx.instanceId,
      instanceName: ctx.instanceName || ctx.instanceId,
      arch: ctx.arch,
      removedAt: new Date().toISOString(),
      mode,
      hasBackup: Boolean(backupPath),
      backupPath: backupPath ?? undefined,
    });
  };

  const uninstallResult = await deps.execResult([
    '-s',
    serial,
    'shell',
    'pm',
    'uninstall',
    '-k',
    '--user',
    '0',
    packageName,
  ]);
  if (pmCommandSucceeded(uninstallResult).ok) {
    record('uninstalled');
    return { mode: 'uninstalled', hasBackup: Boolean(backupPath) };
  }

  const disableResult = await deps.execResult([
    '-s',
    serial,
    'shell',
    'pm',
    'disable-user',
    '--user',
    '0',
    packageName,
  ]);
  if (pmCommandSucceeded(disableResult).ok) {
    record('disabled');
    return { mode: 'disabled', hasBackup: Boolean(backupPath) };
  }

  if (backupPath) deps.deleteBackups();

  const uninstallReason = parsePmResult(uninstallResult.stdout).reason;
  const disableReason = parsePmResult(disableResult.stdout).reason;
  const detail = uninstallReason || disableReason || 'app protegido pelo sistema';
  throw new Error(
    `Não foi possível remover "${packageName}" (${trimReason(detail)}). O app parece ser protegido.`
  );
}

export async function removeApp(
  serial: string,
  instanceId: string,
  instanceName: string,
  arch: string,
  packageName: string
): Promise<{ mode: RemoveMode; hasBackup: boolean }> {
  return removeAppFlow(
    {
      execResult: execAdbResult,
      backupApp: () => backupApp(serial, instanceId, packageName),
      record: (rec) => getRemovedAppsStore().recordRemovedApp(rec),
      deleteBackups: () => deleteBackupFiles(getBackupDir(instanceId), packageName),
    },
    { serial, instanceId, instanceName, arch, packageName }
  );
}

function trimReason(reason: string): string {
  return reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
}

export async function backupApp(
  serial: string,
  instanceId: string,
  packageName: string
): Promise<string | null> {
  const pathOutput = await execAdb(['-s', serial, 'shell', 'pm', 'path', packageName]);
  const pmPaths = parsePackagePaths(pathOutput);
  let paths = pmPaths;
  if (paths.length === 0) {
    const dumpsys = await execAdb(['-s', serial, 'shell', 'dumpsys', 'package', packageName]);
    paths = resolveBackupPaths(pmPaths, parseCodePathLines(dumpsys));
  }
  if (paths.length === 0) return null;
  const dir = getBackupDir(instanceId);
  for (let i = 0; i < paths.length; i++) {
    const local = resolve(dir, i === 0 ? `${packageName}.apk` : `${packageName}.part-${i + 1}.apk`);
    await execAdb(['-s', serial, 'pull', paths[i], local], 600_000);
  }
  return resolve(dir, `${packageName}.apk`);
}

export async function restoreApp(serial: string, apkPath: string): Promise<void> {
  await execAdb(['-s', serial, 'install', '-r', apkPath]);
}

export async function restoreAppByName(
  serial: string,
  instanceId: string,
  packageName: string
): Promise<void> {
  const rec = getRemovedAppsStore()
    .listRemovedApps()
    .find((r) => r.packageName === packageName);
  if (!rec) throw new Error(`Nenhum registro de remoção para ${packageName}`);
  assertRestoreAllowed(rec, instanceId);
  await restoreRemovedApp(serial, instanceId, packageName);
}

function toRemovedAppInfo(rec: RemovedAppRecord): RemovedApp {
  return {
    packageName: rec.packageName,
    label: rec.label,
    instanceId: rec.instanceId,
    instanceName: rec.instanceName,
    arch: rec.arch,
    removedAt: rec.removedAt,
    mode: rec.mode ?? 'uninstalled',
    hasBackup: rec.hasBackup,
  };
}

export function listRemovedApps(): RemovedApp[] {
  return getRemovedAppsStore().listRemovedApps().map(toRemovedAppInfo);
}

export function assertRestoreAllowed(rec: RemovedAppRecord | undefined, instanceId: string): void {
  if (!rec) throw new Error('Nenhum registro de remoção encontrado para este app');
  if (rec.instanceId !== instanceId) {
    throw new Error(
      `O backup pertence à instância "${rec.instanceName || rec.instanceId}". Conecte-se a ela para restaurar.`
    );
  }
  if (!rec.hasBackup && rec.mode === 'uninstalled') {
    throw new Error('Nenhum backup disponível para este app');
  }
}

export type AdbExec = (args: string[]) => Promise<string>;

export async function isPackageInstalled(
  exec: AdbExec,
  serial: string,
  packageName: string
): Promise<boolean> {
  try {
    const output = await exec(['-s', serial, 'shell', 'pm', 'path', packageName]);
    return parsePackagePaths(output).length > 0;
  } catch {
    return false;
  }
}

export async function restoreOnDevice(
  exec: AdbExec,
  serial: string,
  packageName: string,
  backupFiles: string[]
): Promise<void> {
  try {
    await exec(['-s', serial, 'shell', 'pm', 'install-existing', '--user', '0', packageName]);
    if (await isPackageInstalled(exec, serial, packageName)) return;
  } catch {
    /* segue para o fallback com o APK de backup */
  }

  if (backupFiles.length === 0) {
    throw new Error(`Arquivos de backup de ${packageName} não encontrados`);
  }

  try {
    await exec(['-s', serial, ...buildInstallArgs(backupFiles)]);
  } catch (e: unknown) {
    throw new Error(`Não foi possível restaurar "${packageName}": ${formatError(e)}`);
  }

  if (!(await isPackageInstalled(exec, serial, packageName))) {
    throw new Error(`O app "${packageName}" não voltou a ficar instalado após a restauração`);
  }
}

export async function restoreRemovedApp(
  serial: string,
  instanceId: string,
  packageName: string
): Promise<void> {
  const store = getRemovedAppsStore();
  const rec = store.listRemovedApps().find((r) => r.packageName === packageName);
  assertRestoreAllowed(rec, instanceId);

  if (rec?.mode === 'disabled') {
    const enableResult = await execAdbResult([
      '-s',
      serial,
      'shell',
      'pm',
      'enable',
      '--user',
      '0',
      packageName,
    ]);
    if (!pmCommandSucceeded(enableResult).ok) {
      const reason = parsePmResult(enableResult.stdout).reason;
      throw new Error(
        `Não foi possível reativar "${packageName}": ${trimReason(reason || 'erro desconhecido')}`
      );
    }
    if (!(await isPackageInstalled(execAdb, serial, packageName))) {
      throw new Error(`O app "${packageName}" não voltou a ficar instalado após a reativação`);
    }
    store.removeRemovedAppEntry(packageName);
    return;
  }

  const dir = rec?.backupPath ? dirname(rec.backupPath) : getBackupDir(instanceId);
  const files = listBackupFiles(dir, packageName);
  await restoreOnDevice(execAdb, serial, packageName, files);
  files.forEach((f) => {
    try {
      unlinkSync(f);
    } catch {
      /* best effort */
    }
  });
  store.removeRemovedAppEntry(packageName);
}

export function clearRemovedApp(packageName: string): void {
  getRemovedAppsStore().removeRemovedAppEntry(packageName);
}

export function clearRemovedHistory(): void {
  getRemovedAppsStore().clearRemovedHistory();
}
