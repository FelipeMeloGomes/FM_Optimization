import { z } from 'zod';
import { CLEANER_ITEM_IDS } from '../shared/cleaner-items';
import {
  DISPLAY_MAX_FREQUENCY,
  DISPLAY_MIN_FREQUENCY,
  DISPLAY_MIN_HEIGHT,
  DISPLAY_MIN_WIDTH,
} from '../shared/display-settings';
import { DRIVE_LETTER_PATTERN } from '../shared/drive-actions';
import {
  KEYBOARD_BLINK_MAX,
  KEYBOARD_BLINK_MIN,
  KEYBOARD_REPEAT_DELAY_MAX,
  KEYBOARD_REPEAT_DELAY_MIN,
  KEYBOARD_REPEAT_RATE_MAX,
  KEYBOARD_REPEAT_RATE_MIN,
} from '../shared/keyboard-settings';
import {
  MOUSE_DOUBLE_CLICK_MAX,
  MOUSE_DOUBLE_CLICK_MIN,
  MOUSE_POINTER_SPEED_MAX,
  MOUSE_POINTER_SPEED_MIN,
} from '../shared/mouse-settings';
import { isValidOverlayHotkey } from '../shared/overlay-types';
import {
  InterfaceIndexSchema,
  RestorePointNameSchema,
  RestorePointSeqSchema,
  ScriptIdSchema,
} from './branded-types';

const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv4Schema = z.string().regex(ipv4Regex, 'Invalid IPv4 address');

export const DnsAddressesSchema = z.array(ipv4Schema).max(4);

export const DnsProviderSchema = z.object({
  primary: ipv4Schema,
  secondary: ipv4Schema,
});

export const BenchmarkProvidersSchema = z.array(DnsProviderSchema).min(1).max(20);

export const SecuritySettingsSchema = z.object({
  enableIpcValidation: z.boolean().default(true),
  enableDenyListBlock: z.boolean().default(false),
  enablePathValidation: z.boolean().default(true),
  enablePsSanitize: z.boolean().default(true),
});

export const PageLockSchema = z.object({
  enabled: z.boolean().default(true),
  salt: z.string().default(''),
  passwordHashCipher: z.string().default(''),
  lockedPages: z.array(z.string()).default(['/emuladores']),
  unlocked: z.boolean().default(false),
});

export const CleanerIdSchema = z.string().regex(/^cleaner-\d+$/, 'Invalid cleaner id');

export const AutoCleanSchema = z.object({
  enabled: z.boolean().default(false),
  cleaners: z
    .array(CleanerIdSchema)
    .min(1)
    .max(4)
    .default(['cleaner-1', 'cleaner-2', 'cleaner-3', 'cleaner-4']),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  weekday: z.number().int().min(0).max(6).nullable().default(0),
  dayOfMonth: z.number().int().min(1).max(28).nullable().default(1),
  time: z
    .string()
    .regex(/^(?:[01]?\d|2[0-3]):[0-5]\d$/)
    .default('03:00'),
  runOnStartup: z.boolean().default(false),
  catchUp: z.boolean().default(true),
  lastRunAt: z.number().nullable().default(null),
  nextRunAt: z.number().nullable().default(null),
  pending: z.array(CleanerIdSchema).default([]),
});

export const CleanerIdsPayloadSchema = z.object({
  cleanerIds: z.array(CleanerIdSchema).min(1).max(4),
});

export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'midnight', 'amber', 'emerald', 'batman']).default('dark'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#3b82f6'),
  confirmOnExecute: z.boolean().default(true),
  autoRestorePoint: z.boolean().default(true),
  cpuVendorOverride: z.enum(['intel', 'amd']).nullable().default(null),
  security: SecuritySettingsSchema.default(() => SecuritySettingsSchema.parse({})),
  pageLock: PageLockSchema.default(() => PageLockSchema.parse({})),
  soundEnabled: z.boolean().default(true),
  toastDuration: z.enum(['short', 'medium', 'long']).default('medium'),
  adbPath: z.string().nullable().default(null),
  autoClean: AutoCleanSchema.default(() => AutoCleanSchema.parse({})),
  // Sem esta chave o zod descartava o campo no `save-settings` e o toggle nunca
  // era gravado. Padrao ligado: o app e residente na bandeja na maior parte do
  // tempo e os switches (--disable-gpu, renderer-process-limit=1) cortam ~31% da
  // RAM privada em repouso.
  powerSaveMode: z.boolean().default(true),
});

export const VerifyPageLockPasswordSchema = z.object({
  password: z.string().min(1, 'Password required'),
});

export const SetPageLockPasswordSchema = z.object({
  password: z.string().min(4, 'Password must be at least 4 chars'),
});

export const elevateAppSchema = z.object({
  scriptId: ScriptIdSchema.optional(),
  dnsInterfaceIndex: InterfaceIndexSchema.optional(),
  dnsAddresses: DnsAddressesSchema.optional(),
  relaunch: z.boolean().optional(),
});

export const applyDnsSchema = z.object({
  interfaceIndex: InterfaceIndexSchema,
  addresses: DnsAddressesSchema,
});

export const createRestorePointSchema = z.object({
  name: RestorePointNameSchema,
});

export const deleteRestorePointSchema = z.object({
  seq: RestorePointSeqSchema,
});

export const restoreSystemSchema = z.object({
  seq: RestorePointSeqSchema,
});

export const executeScriptSchema = ScriptIdSchema;

export const cancelExecutionSchema = ScriptIdSchema;

export const benchmarkDnsSchema = z.object({
  providers: BenchmarkProvidersSchema,
});

export const EmulatorIdSchema = z.enum(['bluestacks-4', 'bluestacks-5']);

export const adbDetectEmulatorSchema = z.object({
  emulatorId: EmulatorIdSchema,
});

export const adbSetPathSchema = z.object({
  path: z.string().min(1, 'ADB path cannot be empty'),
});

export const adbListAppsSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
});

export const adbRemoveAppSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
  instanceId: z.string().min(1, 'Instance ID is required'),
  instanceName: z.string().optional(),
  arch: z.string().optional(),
  packageName: z.string().min(1, 'Package name is required'),
});

export const adbRestoreRemovedSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
  instanceId: z.string().min(1, 'Instance ID is required'),
  packageName: z.string().min(1, 'Package name is required'),
});

export const adbClearRemovedSchema = z.object({
  packageName: z.string().min(1, 'Package name is required'),
});

export const adbListInstancesSchema = z.object({
  emulatorId: z.string().min(1, 'Emulator ID is required'),
});

export const CleanItemsSchema = z.object({
  ids: z.array(z.enum(CLEANER_ITEM_IDS)).min(1, 'Selecione ao menos um item').max(32),
});

/** PackageFamilyName: nome do pacote + publisher id, sem espaços/aspas. */
export const AppxFamilySchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/, 'Invalid Appx package family');

export const RemoveAppxPackagesSchema = z.object({
  families: z.array(AppxFamilySchema).min(1, 'Selecione ao menos um app').max(50),
});

export const essentialIdSchema = z.string().min(1, 'Program ID is required').max(64);

export const StartupSetEnabledSchema = z.object({
  kind: z.enum(['app', 'task', 'service']),
  id: z.string().min(1, 'Startup entry ID is required').max(2048),
  enabled: z.boolean(),
});

export const StartupOpenLocationSchema = z.object({
  id: z.string().min(1, 'Startup entry ID is required').max(2048),
});

export const StartupStopServiceSchema = z.object({
  id: z.string().min(1, 'Service ID is required').max(2048),
});

export const MouseSettingsSchema = z.object({
  pointerSpeed: z.number().int().min(MOUSE_POINTER_SPEED_MIN).max(MOUSE_POINTER_SPEED_MAX),
  enhancedPrecision: z.boolean(),
  doubleClickSpeed: z.number().int().min(MOUSE_DOUBLE_CLICK_MIN).max(MOUSE_DOUBLE_CLICK_MAX),
});

export const DisplayModeSchema = z.object({
  width: z.number().int().min(DISPLAY_MIN_WIDTH).max(16384),
  height: z.number().int().min(DISPLAY_MIN_HEIGHT).max(16384),
  frequency: z.number().int().min(DISPLAY_MIN_FREQUENCY).max(DISPLAY_MAX_FREQUENCY),
});

export const ApplyDisplaySettingsSchema = z.object({
  deviceName: z.string().regex(/^\\\\\.\\DISPLAY\d{1,2}$/, 'Monitor inválido'),
  mode: DisplayModeSchema,
});

export const KeyboardSettingsSchema = z.object({
  repeatDelay: z.number().int().min(KEYBOARD_REPEAT_DELAY_MIN).max(KEYBOARD_REPEAT_DELAY_MAX),
  repeatRate: z.number().int().min(KEYBOARD_REPEAT_RATE_MIN).max(KEYBOARD_REPEAT_RATE_MAX),
  caretBlinkRate: z.number().int().min(KEYBOARD_BLINK_MIN).max(KEYBOARD_BLINK_MAX),
});

// --- Overlay de jogo -------------------------------------------------------
const overlayWindowsExePath = z
  .string()
  .regex(/^[A-Za-z]:[\\/].+\.exe$/i, 'Informe o caminho absoluto de um .exe');

export const OverlayPositionSchema = z.enum([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

export const AddOverlayGameSchema = z.object({ exePath: overlayWindowsExePath });
export const RemoveOverlayGameSchema = z.string().min(1);
export const LaunchOverlayGameSchema = z.string().min(1);
export const SetOverlayGameEnabledSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});
export const OverlaySettingsSchema = z.object({
  hotkey: z.string().min(1).max(60).refine(isValidOverlayHotkey, 'Atalho de overlay inválido'),
  position: OverlayPositionSchema,
  opacity: z.number().min(0.2).max(1),
  targetFps: z.number().int().min(30).max(360),
  onlyWhenFocused: z.boolean(),
});
/** Somente nomes gerados por `downloadSteamCover` — bloqueia path traversal. */
export const GetOverlayCoverSchema = z.string().regex(/^\d+\.jpg$/i, 'Nome de capa inválido');
const OverlayGameIdSchema = z.string().min(1, 'Jogo inválido');
const DriveLetterSchema = z.string().regex(DRIVE_LETTER_PATTERN, 'Unidade inválida');

export const IpcSchemas: Record<string, z.ZodSchema> = {
  'get-system-info': z.undefined(),
  'get-gpu-catalog': z.undefined(),
  'search-gpu': z.string().min(1).max(120),
  'get-cpu-info': z.undefined(),
  'get-memory-info': z.undefined(),
  'has-ssd': z.undefined(),
  'storage:clean-drive': DriveLetterSchema,
  'storage:optimize-drive': DriveLetterSchema,
  'get-scripts': z.undefined(),
  'execute-script': executeScriptSchema,
  'cancel-execution': cancelExecutionSchema,
  'get-restore-points': z.undefined(),
  'create-restore-point': createRestorePointSchema,
  'delete-restore-point': deleteRestorePointSchema,
  'is-admin': z.undefined(),
  'get-settings': z.undefined(),
  'save-settings': SettingsSchema,
  'verify-page-lock-password': VerifyPageLockPasswordSchema,
  'set-page-lock-password': SetPageLockPasswordSchema,
  'get-app-version': z.undefined(),
  'is-packaged': z.undefined(),
  'get-execution-history': z.undefined(),
  'restore-system': restoreSystemSchema,
  'check-for-update': z.undefined(),
  'download-update': z.undefined(),
  'install-update': z.undefined(),
  'get-network-info': z.undefined(),
  'benchmark-dns': benchmarkDnsSchema,
  'measure-speed': z.undefined(),
  'cancel-speed-test': z.undefined(),
  'apply-dns': applyDnsSchema,
  'elevate-app': elevateAppSchema,
  'get-auto-clean-status': z.undefined(),
  'run-cleaner-now': CleanerIdsPayloadSchema,
  'run-auto-clean-pending': z.undefined(),
  'discard-pending-cleaners': CleanerIdsPayloadSchema,
  'window-minimize': z.undefined(),
  'window-close': z.undefined(),
  'export-data': z.undefined(),
  'import-data': z.string(),
  'adb:get-path': z.undefined(),
  'adb:set-path': adbSetPathSchema,
  'adb:choose-path': z.undefined(),
  'adb:list-devices': z.undefined(),
  'adb:detect-emulator': adbDetectEmulatorSchema,
  'adb:list-apps': adbListAppsSchema,
  'adb:remove-app': adbRemoveAppSchema,
  'adb:list-removed': z.undefined(),
  'adb:restore-removed': adbRestoreRemovedSchema,
  'adb:clear-removed': adbClearRemovedSchema,
  'adb:clear-removed-history': z.undefined(),
  'adb:list-instances': adbListInstancesSchema,
  'get-cleaner-items-stats': z.undefined(),
  'clean-items': CleanItemsSchema,
  'appx:get-inventory': z.boolean().optional(),
  'appx:remove': RemoveAppxPackagesSchema,
  'essentials:list': z.undefined(),
  'essentials:open-page': essentialIdSchema,
  'essentials:install': essentialIdSchema,
  'essentials:cancel-install': essentialIdSchema,
  'startup:list': z.undefined(),
  'startup:set-enabled': StartupSetEnabledSchema,
  'startup:open-location': StartupOpenLocationSchema,
  'startup:stop-service': StartupStopServiceSchema,
  'mouse:get-settings': z.undefined(),
  'mouse:apply-settings': MouseSettingsSchema,
  'display:get-settings': z.undefined(),
  'display:apply-settings': ApplyDisplaySettingsSchema,
  'keyboard:get-settings': z.undefined(),
  'keyboard:apply-settings': KeyboardSettingsSchema,
  'get-overlay-games': z.undefined(),
  'add-overlay-game': AddOverlayGameSchema,
  'remove-overlay-game': RemoveOverlayGameSchema,
  'launch-overlay-game': LaunchOverlayGameSchema,
  'set-overlay-game-enabled': SetOverlayGameEnabledSchema,
  'get-overlay-settings': z.undefined(),
  'save-overlay-settings': OverlaySettingsSchema,
  'get-overlay-status': z.undefined(),
  'start-overlay-monitor': z.undefined(),
  'stop-overlay-monitor': z.undefined(),
  'restart-overlay-elevated': z.undefined(),
  'choose-overlay-exe': z.undefined(),
  'get-overlay-cover': GetOverlayCoverSchema,
  'get-game-display-mode': OverlayGameIdSchema,
  'set-game-borderless': OverlayGameIdSchema,
};

export function validateIpcInput<T>(
  channel: string,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const schema = IpcSchemas[channel];
  if (!schema) {
    return { success: true, data: input as T };
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error: `Validação falhou para ${channel}: ${issues}` };
  }
  return { success: true, data: result.data as T };
}
