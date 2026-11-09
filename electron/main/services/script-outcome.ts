import type { ExecutionHistoryEntry } from '../../shared/ipc-types';

export type RunTrigger = 'manual' | 'scheduled';

/** Handoff via agendador falhou de um jeito que o app não consegue observar. */
export const EXIT_UNKNOWN_HANDOFF = 2;

/** Menu fechado sem aplicar nada (usuário escolheu sair ou só visualizar). */
export const EXIT_MENU_CLOSED_WITHOUT_APPLY = 3;

/** Scripts cujo `2` significa "não sei o que aconteceu no handoff". */
const UNKNOWN_HANDOFF_SCRIPT_IDS: ReadonlySet<string> = new Set(['apps-6', 'apps-7']);

/** Menus em que `3` significa "saiu sem aplicar". */
const MENU_WITHOUT_APPLY_SCRIPT_IDS: ReadonlySet<string> = new Set([
  'tweaks-5',
  'apps-2',
  'builtin-13',
]);

/**
 * Converte os códigos-sentinela dos scripts interativos em `null` (desfecho
 * desconhecido). Sem isso, o histórico mostraria "Erro (2)" para um handoff que
 * pode ter dado certo e o selo "Aplicado" nunca apareceria.
 */
export function normalizeInteractiveExitCode(scriptId: string, code: number | null): number | null {
  if (code === EXIT_UNKNOWN_HANDOFF && UNKNOWN_HANDOFF_SCRIPT_IDS.has(scriptId)) return null;
  if (code === EXIT_MENU_CLOSED_WITHOUT_APPLY && MENU_WITHOUT_APPLY_SCRIPT_IDS.has(scriptId)) {
    return null;
  }
  return code;
}

export function createHistoryEntry(
  scriptId: string,
  scriptName: string,
  startTime: number,
  endTime: number,
  exitCode: number | null,
  wasCancelled: boolean,
  trigger: RunTrigger
): ExecutionHistoryEntry {
  return {
    id: `${scriptId}_${startTime}`,
    scriptId,
    scriptName,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    exitCode,
    wasCancelled,
    trigger,
  };
}
