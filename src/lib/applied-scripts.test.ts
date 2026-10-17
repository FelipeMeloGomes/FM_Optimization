import { describe, expect, it } from 'vitest';
import type { ExecutionHistoryEntry, ScriptEntry } from '../../electron/shared/ipc-types';
import {
  collectAppliedScriptIds,
  isCountableScript,
  NON_COUNTABLE_SCRIPT_IDS,
  summarizeAppliedScripts,
} from './applied-scripts';

function entry(overrides: Partial<ExecutionHistoryEntry>): ExecutionHistoryEntry {
  return {
    id: 'script-1_2026-01-01T00:00:00.000Z',
    scriptId: 'script-1',
    scriptName: 'Script 1',
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    exitCode: 0,
    wasCancelled: false,
    ...overrides,
  };
}

function script(id: string, overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id,
    name: id,
    description: '',
    category: 'Tweaks',
    extension: 'bat',
    ...overrides,
  } as ScriptEntry;
}

describe('collectAppliedScriptIds', () => {
  it('marca scripts com execução bem-sucedida', () => {
    const applied = collectAppliedScriptIds([entry({ scriptId: 'tweak-1' })]);
    expect(applied.has('tweak-1')).toBe(true);
  });

  it('ignora scripts cancelados', () => {
    const applied = collectAppliedScriptIds([
      entry({ scriptId: 'tweak-1', exitCode: null, wasCancelled: true }),
    ]);
    expect(applied.size).toBe(0);
  });

  it('ignora scripts com erro', () => {
    const applied = collectAppliedScriptIds([entry({ scriptId: 'tweak-1', exitCode: 1 })]);
    expect(applied.size).toBe(0);
  });

  it('ignora exitCode nulo sem cancelamento', () => {
    const applied = collectAppliedScriptIds([entry({ scriptId: 'tweak-1', exitCode: null })]);
    expect(applied.size).toBe(0);
  });

  it('deduplica execuções repetidas do mesmo script', () => {
    const applied = collectAppliedScriptIds([
      entry({ id: 'a', scriptId: 'tweak-1' }),
      entry({ id: 'b', scriptId: 'tweak-1' }),
    ]);
    expect(applied.size).toBe(1);
  });

  it('sucesso antigo sobrevive a uma execução posterior cancelada', () => {
    const applied = collectAppliedScriptIds([
      entry({ id: 'a', scriptId: 'tweak-1' }),
      entry({ id: 'b', scriptId: 'tweak-1', exitCode: null, wasCancelled: true }),
    ]);
    expect(applied.has('tweak-1')).toBe(true);
  });

  it('histórico vazio retorna conjunto vazio', () => {
    expect(collectAppliedScriptIds([]).size).toBe(0);
  });
});

describe('isCountableScript', () => {
  it('conta um script normal', () => {
    expect(isCountableScript(script('tweaks-1'))).toBe(true);
  });

  it('não conta interativos: o histórico registra a janela aberta como sucesso', () => {
    expect(isCountableScript(script('dns-1', { interactive: true }))).toBe(false);
  });

  it('não conta reverters nem duplicatas conhecidas', () => {
    for (const id of NON_COUNTABLE_SCRIPT_IDS) {
      expect(isCountableScript(script(id))).toBe(false);
    }
  });

  it('conta scripts de qualquer categoria (Limpeza e Utilitarios incluídos)', () => {
    expect(isCountableScript(script('cleaner-3', { category: 'Cleaner' }))).toBe(true);
    expect(isCountableScript(script('util-1', { category: 'Utilities' }))).toBe(true);
  });
});

describe('summarizeAppliedScripts', () => {
  const catalog = [
    script('tweaks-1'),
    script('cleaner-3', { category: 'Cleaner' }),
    script('util-1', { category: 'Utilities' }),
    script('dns-1', { interactive: true }),
    script('cpu-37'),
  ];

  it('soma no numerador e no denominador o mesmo conjunto elegível', () => {
    const summary = summarizeAppliedScripts(catalog, [
      entry({ scriptId: 'tweaks-1' }),
      entry({ scriptId: 'cleaner-3' }),
    ]);
    // elegíveis: tweaks-1, cleaner-3, util-1 (interativo e cpu-37 fora)
    expect(summary).toEqual({ applied: 2, total: 3 });
  });

  it('aplicado fora do conjunto elegível não infla o numerador', () => {
    const summary = summarizeAppliedScripts(catalog, [
      entry({ scriptId: 'cpu-37' }),
      entry({ scriptId: 'dns-1' }),
    ]);
    expect(summary.applied).toBe(0);
  });

  it('nunca passa de 100%: todo elegível aplicado dá X === Y', () => {
    const summary = summarizeAppliedScripts(catalog, [
      entry({ id: 'a', scriptId: 'tweaks-1' }),
      entry({ id: 'b', scriptId: 'cleaner-3' }),
      entry({ id: 'c', scriptId: 'util-1' }),
      entry({ id: 'd', scriptId: 'cpu-37' }),
    ]);
    expect(summary.applied).toBe(summary.total);
  });

  it('catálogo vazio não divide por zero', () => {
    expect(summarizeAppliedScripts([], [entry({ scriptId: 'tweaks-1' })])).toEqual({
      applied: 0,
      total: 0,
    });
  });
});
