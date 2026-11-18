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

describe('CleanItemsSchema', () => {
  it('aceita ids conhecidos do catálogo', () => {
    const schema = IpcSchemas['clean-items'];
    expect(schema.safeParse({ ids: ['chrome', 'temp-user'] }).success).toBe(true);
  });

  it('rejeita lista vazia', () => {
    const schema = IpcSchemas['clean-items'];
    expect(schema.safeParse({ ids: [] }).success).toBe(false);
  });

  it('rejeita id fora do catálogo', () => {
    const schema = IpcSchemas['clean-items'];
    expect(schema.safeParse({ ids: ['C:\\Windows'] }).success).toBe(false);
  });

  it('rejeita payload sem ids', () => {
    const schema = IpcSchemas['clean-items'];
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('valida get-cleaner-items-stats sem entrada', () => {
    const schema = IpcSchemas['get-cleaner-items-stats'];
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe('Appx schemas', () => {
  it('aceita refresh opcional no inventário', () => {
    const schema = IpcSchemas['appx:get-inventory'];
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(false).success).toBe(true);
  });

  it('aceita lista de famílias com nome e publisher id', () => {
    const schema = IpcSchemas['appx:remove'];
    expect(
      schema.safeParse({ families: ['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe'] }).success
    ).toBe(true);
  });

  it('rejeita lista vazia, família com aspas e mais de 50 apps', () => {
    const schema = IpcSchemas['appx:remove'];
    expect(schema.safeParse({ families: [] }).success).toBe(false);
    expect(schema.safeParse({ families: ["Microsoft.App'; calc"] }).success).toBe(false);
    expect(
      schema.safeParse({
        families: Array.from({ length: 51 }, (_, i) => `Microsoft.App${i}_8wekyb3d8bbwe`),
      }).success
    ).toBe(false);
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

describe('SettingsSchema powerSaveMode', () => {
  it('defaults to enabled', () => {
    expect(SettingsSchema.parse({}).powerSaveMode).toBe(true);
  });

  it('keeps an explicit false so the user can turn it off', () => {
    expect(SettingsSchema.parse({ powerSaveMode: false }).powerSaveMode).toBe(false);
  });

  // Regressao: sem a chave no schema o zod faz strip e o toggle nunca persiste.
  it('survives save-settings validation instead of being stripped', () => {
    const result = validateIpcInput('save-settings', { powerSaveMode: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ powerSaveMode: false });
    }
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
