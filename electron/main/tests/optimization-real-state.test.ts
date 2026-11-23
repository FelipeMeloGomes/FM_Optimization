import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../shared/ipc-types';
import { type OptimizationCheck, parseChecks } from '../services/optimization-checks';

vi.mock('../services/script-registry', () => ({ loadScripts: () => [] }));
vi.mock('../services/script-executor', () => ({
  runScriptSilently: vi.fn(),
  cancelExecution: vi.fn(),
}));

import { analyzeOptimization } from '../services/optimization';
import { POWER_QUERIES } from '../services/optimization-checks';
import { resolvePlan } from '../services/optimization-plan';
import { createSystemStateReader, type ExecFileFn } from '../services/system-state';

const scripts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'resources/scripts.json'), 'utf-8')
) as ScriptEntry[];
const captured = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/optimization/real-state.json'), 'utf-8')
) as Record<string, string>;

function commandFor(check: OptimizationCheck): string {
  if (check.kind === 'registry') return `reg.exe query ${check.key}`;
  if (check.kind === 'tcp') return 'netsh.exe int tcp show global';
  return `powercfg.exe ${POWER_QUERIES[check.setting].args.join(' ')}`;
}

/** Executa o leitor real contra saídas capturadas do Windows deste PC. */
const exec: ExecFileFn = vi.fn(async (file, args) => {
  const command = `${file} ${args.join(' ')}`;
  const stdout = captured[command];
  if (stdout === undefined) throw new Error(`Comando sem fixture: ${command}`);
  return { stdout, stderr: '' };
});

describe('análise contra estado real capturado', () => {
  it('o fixture cobre todos os comandos que o plano consulta', () => {
    const commands = new Set(
      resolvePlan(scripts)
        .flatMap((entry) => parseChecks(entry.script))
        .map(commandFor)
    );
    for (const command of commands) expect(captured[command], command).toBeTypeOf('string');
  });

  it('produz nota e status a partir das saídas reais, sem inventar valores', async () => {
    const report = await analyzeOptimization({ scripts, reader: createSystemStateReader(exec) });

    expect(report.total).toBe(16);
    expect(report.score).not.toBeNull();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(10);
    expect(report.applied + report.pending + report.unknown).toBe(report.total);

    // O registro real do PC tem SearchboxTaskbarMode=0: pelo menos esta
    // verificação tem de bater com o esperado pelo tweak-1.
    const search = report.tweaks.find((tweak) => tweak.id === 'tweaks-1');
    const box = search?.checks.find((check) => check.id.includes('searchboxtaskbarmode'));
    expect(box).toMatchObject({ expected: '0', actual: '0', ok: true });

    // Valores que o Windows não devolve viram unknown, nunca "pendente".
    const semFixture = report.tweaks.flatMap((tweak) =>
      tweak.checks.filter((check) => check.actual === null)
    );
    expect(semFixture.every((check) => check.ok === null)).toBe(true);
  });
});
