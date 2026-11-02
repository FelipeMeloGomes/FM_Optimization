import { describe, expect, it } from 'vitest';
import { IpcSchemas, SettingsSchema, validateIpcInput } from '../validation';

describe('IpcSchemas', () => {
  it('validates execute-script with valid id', () => {
    const schema = IpcSchemas['execute-script'];
    expect(schema.safeParse('intel-30').success).toBe(true);
  });

  it('rejects execute-script with invalid id', () => {
    const schema = IpcSchemas['execute-script'];
    expect(schema.safeParse('bad id').success).toBe(false);
  });

  it('validates apply-dns with valid IPv4', () => {
    const schema = IpcSchemas['apply-dns'];
    const result = schema.safeParse({ interfaceIndex: 12, addresses: ['8.8.8.8'] });
    expect(result.success).toBe(true);
  });

  it('rejects apply-dns with invalid IPv4', () => {
    const schema = IpcSchemas['apply-dns'];
    const result = schema.safeParse({ interfaceIndex: 12, addresses: ['999.1.1.1'] });
    expect(result.success).toBe(false);
  });

  it('validates elevate-app with scriptId', () => {
    const schema = IpcSchemas['elevate-app'];
    expect(schema.safeParse({ scriptId: 'cpu-31' }).success).toBe(true);
  });

  it('validates get-system-info as undefined', () => {
    const schema = IpcSchemas['get-system-info'];
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe('validateIpcInput', () => {
  it('returns success for known channel with valid input', () => {
    const result = validateIpcInput('execute-script', 'intel-30');
    expect(result.success).toBe(true);
  });

  it('returns error for known channel with invalid input', () => {
    const result = validateIpcInput('execute-script', 'bad id');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('execute-script');
    }
  });

  it('passes through unknown channel', () => {
    const result = validateIpcInput('unknown-channel', { foo: 'bar' });
    expect(result.success).toBe(true);
  });
});

describe('SettingsSchema pageLock', () => {
  it('defaults lockedPages to emuladores', () => {
    const r = SettingsSchema.parse({
      theme: 'dark',
      accentColor: '#22d3ee',
      confirmOnExecute: true,
      autoRestorePoint: true,
      soundEnabled: true,
      toastDuration: 'medium',
    });
    expect(r.pageLock.lockedPages).toEqual(['/emuladores']);
    expect(r.pageLock.enabled).toBe(true);
  });

  it('accepts custom lockedPages', () => {
    // O schema so exige strings: a validacao de rota e feita pela migracao em
    // page-lock-routes.ts, que tambem cobre valores legados como /tweaks.
    const r = SettingsSchema.parse({
      pageLock: { lockedPages: ['/emuladores', '/personalizacao'] },
    });
    expect(r.pageLock.lockedPages).toEqual(['/emuladores', '/personalizacao']);
  });
});

describe('SettingsSchema cpuVendorOverride', () => {
  it('defaults to null so detection wins until the user picks manually', () => {
    expect(SettingsSchema.parse({}).cpuVendorOverride).toBeNull();
  });

  it('accepts a real vendor', () => {
    expect(SettingsSchema.parse({ cpuVendorOverride: 'amd' }).cpuVendorOverride).toBe('amd');
    expect(SettingsSchema.parse({ cpuVendorOverride: 'intel' }).cpuVendorOverride).toBe('intel');
  });

  it('accepts an explicit null to clear the override', () => {
    expect(SettingsSchema.parse({ cpuVendorOverride: null }).cpuVendorOverride).toBeNull();
  });

  it('rejects unknown, which would be indistinguishable from no override', () => {
    const r = SettingsSchema.safeParse({ cpuVendorOverride: 'unknown' });
    expect(r.success).toBe(false);
  });

  it('rejects a non-vendor string', () => {
    expect(SettingsSchema.safeParse({ cpuVendorOverride: 'nvidia' }).success).toBe(false);
  });
});

describe('startup schemas', () => {
  it('accepts a valid toggle payload', () => {
    const result = IpcSchemas['startup:set-enabled'].safeParse({
      kind: 'service',
      id: 'service:Spooler',
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    const result = IpcSchemas['startup:set-enabled'].safeParse({
      kind: 'driver',
      id: 'service:Spooler',
      enabled: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(IpcSchemas['startup:open-location'].safeParse({ id: '' }).success).toBe(false);
    expect(IpcSchemas['startup:stop-service'].safeParse({ id: '' }).success).toBe(false);
  });
});

describe('verify-page-lock-password schema', () => {
  it('rejects empty password', () => {
    expect(IpcSchemas['verify-page-lock-password'].safeParse({ password: '' }).success).toBe(false);
  });
  it('accepts non-empty password', () => {
    expect(IpcSchemas['verify-page-lock-password'].safeParse({ password: 'x' }).success).toBe(true);
  });
});
