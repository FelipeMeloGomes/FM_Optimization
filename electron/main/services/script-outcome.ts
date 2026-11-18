import { EXIT_INTERRUPTED_SENTINEL } from '../../shared/exit-codes';
import type { ExecutionHistoryEntry } from '../../shared/ipc-types';

export { EXIT_INTERRUPTED_SENTINEL };

export type RunTrigger = 'manual' | 'scheduled';

/** Handoff via agendador falhou de um jeito que o app não consegue observar. */
export const EXIT_UNKNOWN_HANDOFF = 2;

/** Menu fechado sem aplicar nada (usuário escolheu sair ou só visualizar). */
export const EXIT_MENU_CLOSED_WITHOUT_APPLY = 3;

/** Usuário fechou a janela do console (Ctrl+C / STATUS_CONTROL_C_EXIT). */
export const EXIT_USER_INTERRUPTED = 3221225786; // 0xC000013A

/** Scripts cujo `2` significa "não sei o que aconteceu no handoff". */
const UNKNOWN_HANDOFF_SCRIPT_IDS: ReadonlySet<string> = new Set(['apps-6', 'apps-7']);

/** Scripts onde Ctrl+C (fechar janela) deve virar "interrompido pelo usuário". */
const USER_INTERRUPT_SCRIPT_IDS: ReadonlySet<string> = new Set(['apps-6', 'apps-7']);

/** Menus em que `3` significa "saiu sem aplicar". */
const MENU_WITHOUT_APPLY_SCRIPT_IDS: ReadonlySet<string> = new Set([
  'tweaks-5',
  'apps-2',
  'builtin-13',
]);

/**
 * Converte os códigos-sentinela dos scripts interativos em `null` (desfecho
 * desconhecido) ou na sentinela de interrupção. Sem isso, o histórico mostraria
 * "Erro (2)" ou "Erro (3221225786)" para desfechos que não são erros reais.
 */
export function normalizeInteractiveExitCode(scriptId: string, code: number | null): number | null {
  if (code === EXIT_UNKNOWN_HANDOFF && UNKNOWN_HANDOFF_SCRIPT_IDS.has(scriptId)) return null;
  if (code === EXIT_MENU_CLOSED_WITHOUT_APPLY && MENU_WITHOUT_APPLY_SCRIPT_IDS.has(scriptId)) {
    return null;
  }
  if (code === EXIT_USER_INTERRUPTED && USER_INTERRUPT_SCRIPT_IDS.has(scriptId)) {
    return EXIT_INTERRUPTED_SENTINEL;
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
