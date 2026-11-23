import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/script-registry', () => ({ loadScripts: () => [] }));
vi.mock('../services/script-executor', () => ({
  runScriptSilently: vi.fn(),
  cancelExecution: vi.fn(),
}));

import type {
  OptimizationReport,
  OptimizationTweakStatus,
  ScriptEntry,
} from '../../shared/ipc-types';
import {
  analyzeOptimization,
  applyOptimization,
  getOptimizationApplyDeps,
  isOptimizationSimulationEnabled,
  requestOptimizationCancellation,
  setOptimizationSimulation,
} from '../services/optimization';
import { checkId, type PowerSetting, parseChecks } from '../services/optimization-checks';
import { resolvePlan } from '../services/optimization-plan';
import type { SystemStateReader } from '../services/system-state';

const scripts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'resources/scripts.json'), 'utf-8')
) as ScriptEntry[];

function readerWith(overrides: Map<string, string | null> = new Map()): SystemStateReader {
  const all = resolvePlan(scripts).flatMap((entry) => parseChecks(entry.script));
  const registry = new Map<string, string | null>();
  const tcp = new Map<string, string>();
  const power = new Map<PowerSetting, string | null>();

  for (const check of all) {
    const id = checkId(check);
    const value = overrides.has(id) ? (overrides.get(id) ?? null) : check.expected;
    if (check.kind === 'registry') registry.set(id, value);
    else if (check.kind === 'tcp') tcp.set(check.setting, value ?? '');
    else power.set(check.setting, value);
  }

  return {
    readRegistry: async () => registry,
    readTcp: async () => JSON.stringify(Object.fromEntries(tcp)),
    readPower: async () => power,
  };
}

function tweak(
  id: string,
  status: OptimizationTweakStatus['status'],
  requiresRestart = false
): OptimizationTweakStatus {
  return {
    id,
    area: 'interface',
    name: `Tweak ${id}`,
    description: 'descrição',
    riskLevel: 'moderate',
    requiresAdmin: true,
    requiresRestart,
    status,
    checks: [],
  };
}

function report(tweaks: OptimizationTweakStatus[]): OptimizationReport {
  return {
    score: 5,
    applied: tweaks.filter((item) => item.status === 'applied').length,
    pending: tweaks.filter((item) => item.status === 'pending').length,
    unknown: tweaks.filter((item) => item.status === 'unknown').length,
    total: tweaks.length,
    areas: [],
    tweaks,
    generatedAt: new Date().toISOString(),
  };
}

describe('analyzeOptimization', () => {
  it('dá nota 10 quando o PC bate com todos os ajustes do plano', async () => {
    const result = await analyzeOptimization({ scripts, reader: readerWith() });
    expect(result.total).toBe(16);
    expect(result.score).toBe(10);
    expect(result.applied).toBe(16);
    expect(result.pending).toBe(0);
    expect(result.unknown).toBe(0);
    expect(result.areas).toHaveLength(6);
    expect(result.areas.every((area) => area.score === 10)).toBe(true);
  });

  it('marca como pendente um tweak com valor diferente e derruba a nota', async () => {
    const alvo = resolvePlan(scripts).find((entry) => entry.id === 'tweaks-1');
    if (!alvo) throw new Error('tweaks-1 ausente');
    const checagem = parseChecks(alvo.script)[0];
    const overrides = new Map([[checkId(checagem), 'valor-errado']]);

    const result = await analyzeOptimization({ scripts, reader: readerWith(overrides) });
    const status = result.tweaks.find((item) => item.id === 'tweaks-1');
    expect(status?.status).toBe('pending');
    expect(status?.checks.some((item) => item.ok === false)).toBe(true);
    expect(result.score).toBeLessThan(10);
    expect(result.pending).toBe(1);
  });

  it('exclui do cálculo tweaks que não puderam ser verificados', async () => {
    const alvo = resolvePlan(scripts).find((entry) => entry.id === 'builtin-32');
    if (!alvo) throw new Error('builtin-32 ausente');
    const checagem = parseChecks(alvo.script)[0];
    const reader = readerWith(new Map([[checkId(checagem), null]]));

    const result = await analyzeOptimization({ scripts, reader });
    const status = result.tweaks.find((item) => item.id === 'builtin-32');
    expect(status?.status).toBe('unknown');
    expect(result.unknown).toBe(1);
    expect(result.score).toBe(10);
  });
});

describe('modo simulação (somente dev)', () => {
  it('finge a aplicação sem gravar nada', async () => {
    setOptimizationSimulation(true);
    try {
      expect(isOptimizationSimulationEnabled()).toBe(true);
      const deps = getOptimizationApplyDeps();
      expect(await deps.createRestorePoint?.()).toBeUndefined();
      expect(await deps.run?.('tweaks-1')).toEqual({ code: 0, cancelled: false });

      const executados: string[] = [];
      const result = await applyOptimization(undefined, {
        ...deps,
        analyze: async () => report([tweak('a', 'pending')]),
        run: async (id) => {
          executados.push(id);
          return (await deps.run?.(id)) ?? { code: 1, cancelled: false };
        },
        cancel: vi.fn(),
      });
      expect(executados).toEqual(['a']);
      expect(result.applied).toEqual(['a']);
    } finally {
      setOptimizationSimulation(false);
    }
  });

  it('volta a executar de verdade quando desligado', () => {
    setOptimizationSimulation(false);
    expect(isOptimizationSimulationEnabled()).toBe(false);
    expect(getOptimizationApplyDeps()).toEqual({});
  });
});

describe('applyOptimization', () => {
  it('aplica só as pendências em sequência, com ponto de restauração único e progresso', async () => {
    const executados: string[] = [];
    const eventos: string[] = [];
    const restore = vi.fn(async () => {});
    const result = await applyOptimization(
      (progress) =>
        eventos.push(`${progress.current}/${progress.total}:${progress.id}:${progress.status}`),
      {
        analyze: async () =>
          report([
            tweak('aplicado', 'applied'),
            tweak('primeiro', 'pending'),
            tweak('segundo', 'pending', true),
          ]),
        run: async (id) => {
          executados.push(id);
          return { code: 0, cancelled: false };
        },
        createRestorePoint: restore,
        cancel: vi.fn(),
      }
    );

    expect(executados).toEqual(['primeiro', 'segundo']);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(result.applied).toEqual(['primeiro', 'segundo']);
    expect(result.skipped).toEqual(['aplicado']);
    expect(result.requiresRestart).toEqual(['Tweak segundo']);
    expect(eventos).toEqual([
      '1/2:primeiro:running',
      '1/2:primeiro:done',
      '2/2:segundo:running',
      '2/2:segundo:done',
    ]);
  });

  it('continua a lote quando um tweak falha', async () => {
    const result = await applyOptimization(undefined, {
      analyze: async () => report([tweak('falha', 'pending'), tweak('ok', 'pending')]),
      run: async (id) =>
        id === 'falha' ? { code: 1, cancelled: false } : { code: 0, cancelled: false },
      createRestorePoint: async () => {},
      cancel: vi.fn(),
    });

    expect(result.applied).toEqual(['ok']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.id).toBe('falha');
  });

  it('para o lote quando o cancelamento é pedido', async () => {
    const executados: string[] = [];
    const promise = applyOptimization(undefined, {
      analyze: async () => report([tweak('a', 'pending'), tweak('b', 'pending')]),
      run: async (id) => {
        executados.push(id);
        if (id === 'a') requestOptimizationCancellation();
        return { code: 0, cancelled: false };
      },
      createRestorePoint: async () => {},
      cancel: vi.fn(),
    });

    const result = await promise;
    expect(executados).toEqual(['a']);
    expect(result.cancelled).toBe(true);
    expect(result.skipped).toContain('b');
  });
});
