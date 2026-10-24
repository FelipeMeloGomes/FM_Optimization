import type { ExecutionHistoryEntry, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Ids que não representam um ajuste ativo e por isso não contam para o painel
 * do sistema nem ganham o selo "Aplicado":
 *
 * - reverters (desfazem outros scripts do catálogo);
 * - variantes redundantes do mesmo ajuste (ex.: "Liberar RAM" escreve o mesmo
 *   registro em várias faixas; cpu-11/cpu-12 são a mesma lista de serviços);
 * - ajustes que conflitam entre si (internet-5 anula internet-1).
 *
 * A lista vale para o selo "Aplicado"; o contador do Dashboard aplica ainda o
 * filtro de categoria (`countsAsTweak`).
 */
export const NON_COUNTABLE_SCRIPT_IDS: ReadonlySet<string> = new Set([
  'builtin-6', // AMD - Reverter 3 Frames
  'builtin-7', // AMD - Reverter Tweak Melody
  'internet-11', // Reverter Internet
  'cpu-37', // Resetar RAM Padrao
  'cpu-31', // Liberar RAM 6GB  (cpu-30 "4GB" fica como representante da família)
  'cpu-32', // Liberar RAM 8GB
  'cpu-33', // Liberar RAM 12GB
  'cpu-34', // Liberar RAM 16GB
  'cpu-35', // Liberar RAM 32GB
  'cpu-36', // Liberar RAM 64GB
  'cpu-12', // Desabilitar Servicos (Versao 2) — duplicata de cpu-11
  'internet-5', // Desabilitar Auto-Tuning — conflita com internet-1 (normal)
]);

interface CountableScriptLike {
  id: string;
  interactive?: boolean;
  category?: string;
}

const TWEAK_EXCLUDED_CATEGORIES: ReadonlySet<string> = new Set(['Cleaner']);

/**
 * Interativos ficam de fora: o histórico grava `exitCode 0` no instante em que a
 * janela do CMD abre (script-executor.ts), sem saber o que foi feito lá dentro.
 * Marcar isso como "aplicado" seria afirmar algo que o histórico não sustenta.
 */
export function isCountableScript(script: CountableScriptLike): boolean {
  return script.interactive !== true && !NON_COUNTABLE_SCRIPT_IDS.has(script.id);
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
