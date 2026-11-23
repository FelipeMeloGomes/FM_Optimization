import { spawn } from 'node:child_process';
import type {
  OptimizationAreaSummary,
  OptimizationCheckResult,
  OptimizationProgress,
  OptimizationReport,
  OptimizationSummary,
  OptimizationTweakStatus,
  ScriptEntry,
} from '../../shared/ipc-types';
import {
  checkId,
  type OptimizationCheck,
  type PowerCheck,
  parseChecks,
  type RegistryCheck,
  type TcpCheck,
} from './optimization-checks';
import {
  AREA_LABELS,
  OPTIMIZATION_AREAS,
  type OptimizationArea,
  resolvePlan,
} from './optimization-plan';
import { cancelExecution, runScriptSilently } from './script-executor';
import { loadScripts } from './script-registry';
import {
  createSystemStateReader,
  powerCheckValue,
  registryCheckValue,
  type SystemStateReader,
  tcpCheckValue,
} from './system-state';

export interface AnalyzeDeps {
  reader?: SystemStateReader;
  scripts?: ScriptEntry[];
}

function scoreFor(applied: number, verifiable: number): number | null {
  if (verifiable <= 0) return null;
  return Math.round((applied / verifiable) * 10);
}

function evaluate(check: OptimizationCheck, actual: string | null): OptimizationCheckResult {
  return {
    id: checkId(check),
    expected: check.expected,
    actual,
    ok: actual === null ? null : actual === check.expected,
  };
}

/** Compara o estado real do PC com o plano curado e devolve a nota. */
export async function analyzeOptimization(deps: AnalyzeDeps = {}): Promise<OptimizationReport> {
  const reader = deps.reader ?? createSystemStateReader();
  const scripts = deps.scripts ?? loadScripts();
  const plan = resolvePlan(scripts);

  const registryChecks: RegistryCheck[] = [];
  const powerChecks: PowerCheck[] = [];
  const tcpChecks: TcpCheck[] = [];
  const checksByTweak = new Map<string, OptimizationCheck[]>();

  for (const entry of plan) {
    const checks = parseChecks(entry.script);
    checksByTweak.set(entry.id, checks);
    for (const check of checks) {
      if (check.kind === 'registry') registryChecks.push(check);
      else if (check.kind === 'power') powerChecks.push(check);
      else tcpChecks.push(check);
    }
  }

  const [registry, tcpRaw, power] = await Promise.all([
    reader.readRegistry(registryChecks),
    tcpChecks.length ? reader.readTcp() : Promise.resolve(null),
    powerChecks.length
      ? reader.readPower([...new Set(powerChecks.map((check) => check.setting))])
      : Promise.resolve(new Map()),
  ]);

  const tweaks: OptimizationTweakStatus[] = plan.map((entry) => {
    const results: OptimizationCheckResult[] = [];
    for (const check of checksByTweak.get(entry.id) ?? []) {
      if (check.kind === 'registry') {
        results.push(evaluate(check, registryCheckValue(check, registry)));
      } else if (check.kind === 'power') {
        results.push(evaluate(check, powerCheckValue(check, power)));
      } else {
        results.push(evaluate(check, tcpCheckValue(check, tcpRaw)));
      }
    }

    const unknown = results.some((result) => result.ok === null);
    const applied = results.length > 0 && results.every((result) => result.ok === true);
    return {
      id: entry.id,
      area: entry.area,
      name: entry.script.name,
      description: entry.script.description,
      riskLevel: entry.script.riskLevel ?? 'moderate',
      requiresAdmin: entry.script.requiresAdmin,
      requiresRestart: entry.script.requiresRestart === true,
      status: unknown ? 'unknown' : applied ? 'applied' : 'pending',
      checks: results,
    };
  });

  const applied = tweaks.filter((tweak) => tweak.status === 'applied').length;
  const unknown = tweaks.filter((tweak) => tweak.status === 'unknown').length;
  const verifiable = tweaks.length - unknown;

  const areas: OptimizationAreaSummary[] = OPTIMIZATION_AREAS.map((area) => {
    const inArea = tweaks.filter((tweak) => tweak.area === area);
    const areaApplied = inArea.filter((tweak) => tweak.status === 'applied').length;
    const areaUnknown = inArea.filter((tweak) => tweak.status === 'unknown').length;
    return {
      area,
      label: AREA_LABELS[area as OptimizationArea],
      applied: areaApplied,
      total: inArea.length,
      score: scoreFor(areaApplied, inArea.length - areaUnknown),
    };
  });

  return {
    score: scoreFor(applied, verifiable),
    applied,
    pending: tweaks.filter((tweak) => tweak.status === 'pending').length,
    unknown,
    total: tweaks.length,
    areas,
    tweaks,
    generatedAt: new Date().toISOString(),
  };
}

export async function createOptimizationRestorePoint(): Promise<void> {
  const code = await new Promise<number | null>((resolve) => {
    const proc = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Checkpoint-Computer -Description "Antes de Otimizar PC" -RestorePointType MODIFY_SETTINGS',
      ],
      { windowsHide: true, stdio: 'ignore' }
    );
    proc.on('close', (value) => resolve(value));
    proc.on('error', () => resolve(null));
  });

  if (code !== 0) throw new Error('Não foi possível criar o ponto de restauração.');
}

export interface ApplyDeps {
  analyze?: () => Promise<OptimizationReport>;
  run?: (id: string) => Promise<{ code: number | null; cancelled: boolean }>;
  createRestorePoint?: () => Promise<void>;
  cancel?: (id: string) => void;
}

let cancelRequested = false;
let simulationEnabled = false;

/** Modo somente dev: a análise continua real, mas nada é gravado ao aplicar. */
export function setOptimizationSimulation(enabled: boolean): void {
  simulationEnabled = enabled;
}

export function isOptimizationSimulationEnabled(): boolean {
  return simulationEnabled;
}

export function getOptimizationApplyDeps(): Pick<ApplyDeps, 'run' | 'createRestorePoint'> {
  if (!simulationEnabled) return {};
  return {
    run: async () => ({ code: 0, cancelled: false }),
    createRestorePoint: async () => {},
  };
}

export function requestOptimizationCancellation(): void {
  cancelRequested = true;
}

export function isOptimizationCancellationRequested(): boolean {
  return cancelRequested;
}

/** Aplica somente as pendências, em série, com um ponto de restauração para o lote. */
export async function applyOptimization(
  onProgress?: (progress: OptimizationProgress) => void,
  deps: ApplyDeps = {}
): Promise<OptimizationSummary> {
  cancelRequested = false;
  const analyze = deps.analyze ?? (() => analyzeOptimization());
  const run = deps.run ?? ((id: string) => runScriptSilently(id));
  const createRestorePoint = deps.createRestorePoint ?? createOptimizationRestorePoint;
  const cancel = deps.cancel ?? cancelExecution;

  const report = await analyze();
  if (report.tweaks.length === 0) throw new Error('Plano de otimização vazio.');
  const pending = report.tweaks.filter((tweak) => tweak.status === 'pending');
  const skipped = report.tweaks
    .filter((tweak) => tweak.status === 'applied' || tweak.status === 'unknown')
    .map((tweak) => tweak.id);

  await createRestorePoint();

  const summary: OptimizationSummary = {
    applied: [],
    failed: [],
    skipped,
    cancelled: false,
    requiresRestart: [],
  };

  for (const [index, tweak] of pending.entries()) {
    if (cancelRequested) {
      summary.cancelled = true;
      summary.skipped.push(...pending.slice(index).map((item) => item.id));
      break;
    }

    const progress: OptimizationProgress = {
      current: index + 1,
      total: pending.length,
      id: tweak.id,
      name: tweak.name,
      status: 'running',
    };
    onProgress?.(progress);

    try {
      const result = await run(tweak.id);
      if (result.cancelled || cancelRequested) {
        cancel(tweak.id);
        summary.cancelled = true;
        summary.skipped.push(...pending.slice(index).map((item) => item.id));
        onProgress?.({ ...progress, status: 'cancelled' });
        break;
      }
      if (result.code !== 0) {
        throw new Error(`O script terminou com código ${result.code ?? 'desconhecido'}.`);
      }
      summary.applied.push(tweak.id);
      if (tweak.requiresRestart) summary.requiresRestart.push(tweak.name);
      onProgress?.({ ...progress, status: 'done' });
    } catch (error) {
      summary.failed.push({
        id: tweak.id,
        name: tweak.name,
        error: error instanceof Error ? error.message : String(error),
      });
      onProgress?.({ ...progress, status: 'failed' });
    }
  }

  return summary;
}
