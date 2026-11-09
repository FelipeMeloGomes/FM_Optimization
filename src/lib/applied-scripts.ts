import type { ExecutionHistoryEntry, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Ids que não representam um ajuste ativo e por isso não contam para o painel
 * do sistema nem ganham o selo "Aplicado":
 *
 * - reverters (desfazem outros scripts do catálogo);
 * - variantes redundantes do mesmo ajuste (ex.: "Limite do svchost" escreve a
 *   mesma chave de registro em várias faixas);
 * - ajustes que conflitam entre si (internet-5 anula internet-1).
 *
 * A lista vale para o selo "Aplicado"; o contador do Dashboard aplica ainda o
 * filtro de categoria (`countsAsTweak`).
 */
export const NON_COUNTABLE_SCRIPT_IDS: ReadonlySet<string> = new Set([
  'builtin-6', // AMD - Reverter 3 Frames
  'builtin-7', // AMD - Reverter Tweak Melody
  'internet-11', // Reverter Internet
  'cpu-37', // Restaurar Limite do svchost (380000 KB)
  'cpu-31', // Limite do svchost (6 GB) — cpu-30 "4 GB" fica como representante
  'cpu-32', // Limite do svchost (8 GB)
  'cpu-33', // Limite do svchost (12 GB)
  'cpu-34', // Limite do svchost (16 GB)
  'cpu-35', // Limite do svchost (32 GB)
  'cpu-36', // Limite do svchost (64 GB)
  'internet-5', // Desabilitar Auto-Tuning — conflita com internet-1 (normal)
  'apps-5', // Reverter Discord — desfaz o apps-4
  'apps-7', // Reverter Spotify — desfaz o apps-6
  'util-3', // Relatorios do Sistema — utilitario, nao aplica ajuste
  'cpu-2', // Super Limpeza — limpeza profunda, nao e tweak
]);

interface CountableScriptLike {
  id: string;
  category?: string;
}

const TWEAK_EXCLUDED_CATEGORIES: ReadonlySet<string> = new Set(['Cleaner']);

/**
 * Interativos contam como qualquer outro ajuste: o app agora observa a janela
 * até o fim e registra o exit code real. A lista de exclusões cobre os que,
 * mesmo interativos, não representam um ajuste ativo (reverters, utilitários e
 * limpeza).
 */
export function isCountableScript(script: CountableScriptLike): boolean {
  return !NON_COUNTABLE_SCRIPT_IDS.has(script.id);
}

/**
 * Contador do Dashboard: limpeza não é ajuste aplicado. A página Limpeza tem
 * selo próprio e continua usando `isCountableScript` — separar as duas regras
 * evita que uma limpeza agendada infle o número de tweaks.
 */
function countsAsTweak(script: CountableScriptLike): boolean {
  return isCountableScript(script) && !TWEAK_EXCLUDED_CATEGORIES.has(script.category ?? '');
}

/** Ids com pelo menos uma execução bem-sucedida no histórico (cancelado/erro não conta). */
export function collectAppliedScriptIds(history: ExecutionHistoryEntry[]): Set<string> {
  const applied = new Set<string>();
  for (const entry of history) {
    if (entry.exitCode === 0 && !entry.wasCancelled) {
      applied.add(entry.scriptId);
    }
  }
  return applied;
}

/**
 * Ajustes elegíveis (para o denominador) e aplicados (para o numerador), sempre
 * com o mesmo filtro — assim o numerador nunca passa o denominador. Limpeza
 * fica fora dos dois lados: não é tweak, tem página e histórico próprios.
 */
export function summarizeAppliedScripts(
  scripts: ScriptEntry[],
  history: ExecutionHistoryEntry[]
): { applied: number; total: number } {
  const eligibleIds = new Set<string>();
  for (const script of scripts) {
    if (countsAsTweak(script)) eligibleIds.add(script.id);
  }

  const appliedIds = new Set<string>();
  for (const id of collectAppliedScriptIds(history)) {
    if (eligibleIds.has(id)) appliedIds.add(id);
  }

  return { applied: appliedIds.size, total: eligibleIds.size };
}
