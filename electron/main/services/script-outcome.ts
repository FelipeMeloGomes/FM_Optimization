import type { ExecutionHistoryEntry, ScriptEnded } from '../../shared/ipc-types';

export type RunTrigger = 'manual' | 'scheduled';

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

export interface InteractiveOpenDeps {
  notify: (data: ScriptEnded) => void;
  recordHistory: (entry: ExecutionHistoryEntry) => void;
  audit: (exitCode: number | null, success: boolean) => void;
  now: () => number;
}

/**
 * Um script interativo abre uma janela própria e sai do controle do app no
 * instante em que ela aparece: o que o usuário faz lá dentro não é observável.
 *
 * Registrar `exitCode: 0` aqui fazia o histórico e o toast ("Tweak executado")
 * afirmarem um sucesso que ninguém viu. O desfecho é desconhecido — `null` no
 * histórico e `success: false` na auditoria.
 */
export function reportInteractiveOpen(
  { id, scriptName, trigger }: { id: string; scriptName?: string; trigger: RunTrigger },
  deps: InteractiveOpenDeps
): void {
  const at = deps.now();
  deps.notify({ id, code: null, scriptName, trigger });
  deps.recordHistory(createHistoryEntry(id, scriptName || id, at, at, null, false, trigger));
  deps.audit(null, false);
}
