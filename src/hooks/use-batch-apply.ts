import { useCallback, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

type ExecuteBatch = (scripts: ScriptEntry[]) => Promise<{ failedIds: string[] }>;

/**
 * Aplica lotes e concentra o preenchimento de `failedScripts` — tanto no apply
 * direto quanto na confirmação do diálogo, que antes repetiam o mesmo `.then`.
 */
export function useBatchApply(executeBatch: ExecuteBatch) {
  const [failedScripts, setFailedScripts] = useState<ScriptEntry[]>([]);

  const runBatch = useCallback(
    (scripts: ScriptEntry[]) => {
      void executeBatch(scripts).then(
        ({ failedIds }) => setFailedScripts(scripts.filter((s) => failedIds.includes(s.id))),
        (error: unknown) => {
          setFailedScripts([...scripts]);
          console.error('Falha ao aplicar o lote de scripts:', error);
        }
      );
    },
    [executeBatch]
  );

  const clearFailures = useCallback(() => setFailedScripts([]), []);

  return { runBatch, failedScripts, clearFailures };
}
