import type { OptimizationArea, ScriptEntry } from '../../shared/ipc-types';

export type { OptimizationArea } from '../../shared/ipc-types';

export const OPTIMIZATION_AREAS: readonly OptimizationArea[] = [
  'interface',
  'privacidade',
  'energia',
  'jogos',
  'input-lag',
  'rede',
];

export const AREA_LABELS: Record<OptimizationArea, string> = {
  interface: 'Interface',
  privacidade: 'Privacidade',
  energia: 'Energia',
  jogos: 'Jogos',
  'input-lag': 'Input lag',
  rede: 'Rede',
};

export interface PlanEntry {
  id: string;
  area: OptimizationArea;
  /** Ordem de exibição dentro da área. */
  order: number;
}

/**
 * Plano curado de ajustes com estado persistente. Cada ID vem do scripts.json
 * real — a página não inventa nomes nem duplica descrições.
 *
 * Os critérios para entrar aqui: escrever registro/netsh/powercfg, não pedir
 * interação, não ser reversão e não disputar a mesma chave com outro membro do
 * plano. A validação dessas regras vive em optimization-plan.test.ts.
 */
export const OPTIMIZATION_PLAN: readonly PlanEntry[] = [
  { id: 'tweaks-1', area: 'interface', order: 0 },
  { id: 'tweaks-2', area: 'interface', order: 1 },
  { id: 'builtin-32', area: 'interface', order: 2 },
  { id: 'cpu-20', area: 'interface', order: 3 },
  { id: 'apps-1', area: 'privacidade', order: 0 },
  { id: 'tweaks-3', area: 'energia', order: 0 },
  { id: 'tweaks-4', area: 'jogos', order: 0 },
  { id: 'cpu-16', area: 'jogos', order: 1 },
  { id: 'inputlag-1', area: 'input-lag', order: 0 },
  { id: 'inputlag-2', area: 'input-lag', order: 1 },
  { id: 'inputlag-3', area: 'input-lag', order: 2 },
  { id: 'inputlag-5', area: 'input-lag', order: 3 },
  { id: 'inputlag-6', area: 'input-lag', order: 4 },
  { id: 'inputlag-8', area: 'input-lag', order: 5 },
  { id: 'internet-7', area: 'rede', order: 0 },
  { id: 'builtin-18', area: 'rede', order: 1 },
];

export interface ResolvedPlanEntry extends PlanEntry {
  script: ScriptEntry;
}

/** Resolve o plano contra o catálogo real, falhando alto se um ID sumir. */
export function resolvePlan(scripts: ScriptEntry[]): ResolvedPlanEntry[] {
  const byId = new Map(scripts.map((script) => [script.id, script]));
  return OPTIMIZATION_PLAN.map((entry) => {
    const script = byId.get(entry.id);
    if (!script) throw new Error(`Tweak do plano não encontrado no catálogo: ${entry.id}`);
    return { ...entry, script };
  });
}
