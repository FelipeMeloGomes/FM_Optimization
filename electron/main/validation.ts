import { z } from 'zod';
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

export const ExportDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  settings: SettingsSchema.partial().optional(),
  history: z
    .array(
      z.object({
        id: z.string(),
        scriptId: z.string(),
        scriptName: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        durationMs: z.number(),
        exitCode: z.number().nullable(),
        wasCancelled: z.boolean(),
      })
    )
    .optional(),
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

export const adbBackupAppSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
  instanceId: z.string().min(1, 'Instance ID is required'),
  packageName: z.string().min(1, 'Package name is required'),
});

export const adbRestoreAppSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
  apkPath: z.string().min(1, 'APK path is required'),
});

export const adbRestoreAppByNameSchema = z.object({
  serial: z.string().min(1, 'Device serial is required'),
  instanceId: z.string().min(1, 'Instance ID is required'),
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

export const getCleanerStatsSchema = z.string().min(1, 'Cleaner ID is required');

export const IpcSchemas: Record<string, z.ZodSchema> = {
  'get-system-info': z.undefined(),
  'get-cpu-info': z.undefined(),
  'get-memory-info': z.undefined(),
  'has-ssd': z.undefined(),
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
  'apply-dns': applyDnsSchema,
  'elevate-app': elevateAppSchema,
  'window-minimize': z.undefined(),
  'window-close': z.undefined(),
  'export-data': z.undefined(),
  'import-data': z.string(),
  'adb:get-path': z.undefined(),
  'adb:set-path': adbSetPathSchema,
  'adb:list-devices': z.undefined(),
  'adb:detect-emulator': adbDetectEmulatorSchema,
  'adb:list-apps': adbListAppsSchema,
  'adb:remove-app': adbRemoveAppSchema,
  'adb:backup-app': adbBackupAppSchema,
  'adb:restore-app': adbRestoreAppSchema,
  'adb:restore-app-by-name': adbRestoreAppByNameSchema,
  'adb:list-removed': z.undefined(),
  'adb:restore-removed': adbRestoreRemovedSchema,
  'adb:clear-removed': adbClearRemovedSchema,
  'adb:clear-removed-history': z.undefined(),
  'adb:list-instances': adbListInstancesSchema,
  'get-cleaner-stats': getCleanerStatsSchema,
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
