import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import type { ExecutionHistoryEntry } from '../../shared/ipc-types';
import {
  LEGACY_SCRIPT_ID_ALIASES,
  resolveScriptId,
  rewriteHistoryScriptIds,
} from '../legacy-script-ids';

const entry = (
  scriptId: string,
  rest: Partial<ExecutionHistoryEntry> = {}
): ExecutionHistoryEntry =>
  ({
    id: `h-${scriptId}`,
    scriptId,
    scriptName: 'legacy',
    status: 'success',
    timestamp: 1700000000000,
    exitCode: 0,
    output: '',
    ...rest,
  }) as ExecutionHistoryEntry;

describe('resolveScriptId', () => {
  it('resolves every retired vendor id to its merged cpu script', () => {
    expect(resolveScriptId('amd-1')).toBe('cpu-1');
    expect(resolveScriptId('intel-1')).toBe('cpu-1');
    expect(resolveScriptId('amd-15')).toBe('cpu-15');
    expect(resolveScriptId('intel-8')).toBe('cpu-15');
    expect(resolveScriptId('amd-37')).toBe('cpu-37');
    expect(resolveScriptId('intel-37')).toBe('cpu-37');
  });

  it('resolves the retired cpu ids to their surviving twin', () => {
    // aposentados na dedup da beta; a equivalência foi conferida no conteúdo
    expect(resolveScriptId('cpu-12')).toBe('cpu-11');
    expect(resolveScriptId('cpu-24')).toBe('cpu-21');
    expect(resolveScriptId('cpu-29')).toBe('cpu-21');
  });

  it('passes current ids through untouched', () => {
    for (let n = 1; n <= 37; n++) {
      if (n === 12 || n === 24 || n === 29) continue;
      expect(resolveScriptId(`cpu-${n}`)).toBe(`cpu-${n}`);
    }
    expect(resolveScriptId('builtin-13')).toBe('builtin-13');
    expect(resolveScriptId('tweaks-4')).toBe('tweaks-4');
  });

  it('leaves an unknown id alone instead of guessing', () => {
    expect(resolveScriptId('amd-999')).toBe('amd-999');
    expect(resolveScriptId('inputlag-12')).toBe('inputlag-12');
    expect(resolveScriptId('')).toBe('');
  });

  it('aliases only retired vendor ids and retired cpu ids', () => {
    for (const key of Object.keys(LEGACY_SCRIPT_ID_ALIASES)) {
      expect(key).toMatch(/^(amd|intel|cpu)-\d+$/);
    }
  });
});

describe('LEGACY_SCRIPT_ID_ALIASES', () => {
  const keys = Object.keys(LEGACY_SCRIPT_ID_ALIASES);
  const vendorKeys = keys.filter((k) => k.startsWith('amd-') || k.startsWith('intel-'));

  it('covers all 74 retired vendor ids exactly once', () => {
    expect(vendorKeys).toHaveLength(74);
    expect(vendorKeys.filter((k) => k.startsWith('amd-'))).toHaveLength(37);
    expect(vendorKeys.filter((k) => k.startsWith('intel-'))).toHaveLength(37);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('points every alias at a surviving cpu script', () => {
    for (const merged of Object.values(LEGACY_SCRIPT_ID_ALIASES)) {
      expect(merged).toMatch(/^cpu-\d+$/);
    }
  });

  it('keeps the vendor pairs together even after the dedup', () => {
    const byTarget = new Map<string, string[]>();
    for (const key of vendorKeys) {
      const merged = LEGACY_SCRIPT_ID_ALIASES[key];
      byTarget.set(merged, [...(byTarget.get(merged) ?? []), key]);
    }

    // 34 scripts de CPU sobreviveram; cpu-11 e cpu-21 absorveram os pares
    // aposentados, então cada destino continua com amd e intel em igual número.
    expect(byTarget.size).toBe(34);
    for (const [merged, sources] of byTarget) {
      const amd = sources.filter((s) => s.startsWith('amd-')).length;
      const intel = sources.filter((s) => s.startsWith('intel-')).length;
      expect(amd, merged).toBe(intel);
    }
  });

  it('never points an alias at itself', () => {
    for (const key of keys) {
      expect(LEGACY_SCRIPT_ID_ALIASES[key]).not.toBe(key);
    }
  });
});

describe('alias table agrees with the shipped catalog', () => {
  // The pure functions above are covered in isolation, but the actual promise is
  // that an old id still reaches real content. This cross-checks the table
  // against resources/scripts.json, so a stale or mistyped alias fails here
  // rather than at runtime for a user who last ran an older build.
  const catalog: { id: string; content: string }[] = JSON.parse(
    readFileSync(resolve(cwd(), 'resources/scripts.json'), 'utf-8')
  );
  const byId = new Map(catalog.map((s) => [s.id, s]));

  it('resolves every alias to a catalog entry with content', () => {
    const broken: string[] = [];
    for (const [legacy, merged] of Object.entries(LEGACY_SCRIPT_ID_ALIASES)) {
      const target = byId.get(resolveScriptId(legacy));
      if (!target?.content) broken.push(`${legacy} -> ${merged}`);
    }
    expect(broken).toEqual([]);
  });

  it('leaves no cpu script unreachable through an alias', () => {
    const aliased = new Set(Object.values(LEGACY_SCRIPT_ID_ALIASES));
    const cpu = catalog.filter((s) => /^cpu-\d+$/.test(s.id)).map((s) => s.id);
    expect(cpu.filter((id) => !aliased.has(id))).toEqual([]);
  });

  it('rejects a legacy id that was never in the catalog', () => {
    // Guards the guard: resolveScriptId is permissive by design, so a typo'd
    // id passes through and is caught by the catalog lookup, not by the alias.
    expect(resolveScriptId('amd-38')).toBe('amd-38');
    expect(byId.has('amd-38')).toBe(false);
  });
});

describe('rewriteHistoryScriptIds', () => {
  it('rewrites legacy ids and reports the change', () => {
    const entries = [entry('amd-1'), entry('intel-37'), entry('cpu-5')];
    expect(rewriteHistoryScriptIds(entries)).toBe(true);
    expect(entries.map((e) => e.scriptId)).toEqual(['cpu-1', 'cpu-37', 'cpu-5']);
  });

  it('is a no-op when nothing is legacy', () => {
    const entries = [entry('cpu-1'), entry('builtin-13')];
    expect(rewriteHistoryScriptIds(entries)).toBe(false);
    expect(entries.map((e) => e.scriptId)).toEqual(['cpu-1', 'builtin-13']);
  });

  it('tolerates an empty history', () => {
    expect(rewriteHistoryScriptIds([])).toBe(false);
  });

  it('preserves scriptName so old rows still render', () => {
    const entries = [entry('amd-1', { scriptName: 'Otimizacao AMD (Geral)' })];
    rewriteHistoryScriptIds(entries);
    expect(entries[0].scriptName).toBe('Otimizacao AMD (Geral)');
  });
});
