import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStartupOverridesStore } from '../services/startup-overrides';

const tempDirs: string[] = [];

function makeStore() {
  const dir = mkdtempSync(resolve(tmpdir(), 'startup-overrides-'));
  tempDirs.push(dir);
  return createStartupOverridesStore(dir);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('createStartupOverridesStore', () => {
  it('starts empty', () => {
    const store = makeStore();
    expect(store.listServiceOverrides()).toEqual({});
    expect(store.getServiceStartMode('Spooler')).toBeNull();
  });

  it('records the original start mode', () => {
    const store = makeStore();
    store.recordServiceStartMode('SysMain', 'AutomaticDelayed');

    expect(store.getServiceStartMode('SysMain')).toBe('AutomaticDelayed');
    expect(store.listServiceOverrides()).toEqual({ SysMain: 'AutomaticDelayed' });
  });

  it('keeps the first recorded original when called twice', () => {
    const store = makeStore();
    store.recordServiceStartMode('SysMain', 'AutomaticDelayed');
    store.recordServiceStartMode('SysMain', 'Automatic');

    expect(store.getServiceStartMode('SysMain')).toBe('AutomaticDelayed');
  });

  it('clears one service', () => {
    const store = makeStore();
    store.recordServiceStartMode('SysMain', 'AutomaticDelayed');
    store.recordServiceStartMode('Spooler', 'Automatic');
    store.clearServiceStartMode('SysMain');

    expect(store.listServiceOverrides()).toEqual({ Spooler: 'Automatic' });
  });

  it('survives a corrupt file', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'startup-overrides-corrupt-'));
    tempDirs.push(dir);
    writeFileSync(resolve(dir, 'startup-overrides.json'), '{not json', 'utf-8');

    const store = createStartupOverridesStore(dir);
    expect(store.listServiceOverrides()).toEqual({});
  });
});
