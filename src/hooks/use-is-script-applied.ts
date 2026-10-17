import { useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useHistoryContext } from '../contexts/HistoryContext';
import { collectAppliedScriptIds, isCountableScript } from '../lib/applied-scripts';

type ScriptLike = Pick<ScriptEntry, 'id'> & { interactive?: boolean };

/**
 * "Já aplicado?": selo e contador usam exatamente a mesma regra
 * (`isCountableScript` + execução bem-sucedida no histórico). Recarrega sozinho
 * quando um script termina, porque o HistoryContext escuta `script-ended`.
 */
export function useIsScriptApplied(): (script: ScriptLike) => boolean {
  const { state } = useHistoryContext();

  const appliedIds = useMemo(
    () => (state.status === 'success' ? collectAppliedScriptIds(state.data) : new Set<string>()),
    [state]
  );

  return useMemo(
    () => (script: ScriptLike) => isCountableScript(script) && appliedIds.has(script.id),
    [appliedIds]
  );
}
