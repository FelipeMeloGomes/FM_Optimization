import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useScriptContext } from '../contexts/ScriptContext';
import { useScriptExecutionContext } from '../contexts/ScriptExecutionContext';
import { useSettingsContext } from '../contexts/SettingsContext';

export function useScriptPage(categories: string | string[]) {
  const {
    state,
    filteredScripts,
    setCategoryFilter,
    setSubcategoryFilter,
    retry: reloadScripts,
  } = useScriptContext();
  const { activeExecution, execute, cancel, batch, executeBatch } = useScriptExecutionContext();
  const { settings } = useSettingsContext();
  const [confirmScript, setConfirmScript] = useState<ScriptEntry | null>(null);
  const [confirmBulkScripts, setConfirmBulkScripts] = useState<ScriptEntry[]>([]);
  const [failedScripts, setFailedScripts] = useState<ScriptEntry[]>([]);

  // Keyed on the joined names rather than the array identity: a caller building
  // the list inline would otherwise change the reference every render and re-run
  // the effect below on every pass.
  const categoryKey = Array.isArray(categories) ? categories.join('\0') : categories;
  const categoryList = useMemo(() => (categoryKey ? categoryKey.split('\0') : []), [categoryKey]);

  useEffect(() => {
    // The context filter only holds one category, and '' means "no filter", so a
    // multi-category page clears it and narrows the set below instead.
    setCategoryFilter(categoryList.length === 1 ? categoryList[0] : '');
    setSubcategoryFilter('');
  }, [categoryList, setCategoryFilter, setSubcategoryFilter]);

  const categoryScripts = useMemo(() => {
    const wanted = new Set(categoryList);
    return filteredScripts.filter((s) => wanted.has(s.category));
  }, [filteredScripts, categoryList]);

  const handleExecute = useCallback((id: string) => execute(id), [execute]);
  const handleCancel = useCallback((id: string) => cancel(id), [cancel]);

  const handleConfirmExecute = useCallback(
    (script: ScriptEntry) => {
      if (settings.confirmOnExecute) {
        setConfirmScript(script);
      } else {
        handleExecute(script.id);
      }
    },
    [settings.confirmOnExecute, handleExecute]
  );

  const handleConfirm = useCallback(() => {
    if (confirmScript) {
      handleExecute(confirmScript.id);
    }
  }, [confirmScript, handleExecute]);

  const handleApply = useCallback(
    (scripts: ScriptEntry[]) => {
      if (settings.confirmOnExecute) {
        setConfirmBulkScripts(scripts);
        return;
      }
      void executeBatch(scripts).then(
        ({ failedIds }) => {
          setFailedScripts(scripts.filter((s) => failedIds.includes(s.id)));
        },
        (error) => {
          setFailedScripts([...scripts]);
          console.error('Falha ao aplicar o lote de scripts:', error);
        }
      );
    },
    [settings.confirmOnExecute, executeBatch]
  );

  const handleConfirmBulk = useCallback(() => {
    const scripts = confirmBulkScripts;
    setConfirmBulkScripts([]);
    if (scripts.length > 0) {
      void executeBatch(scripts).then(
        ({ failedIds }) => {
          setFailedScripts(scripts.filter((s) => failedIds.includes(s.id)));
        },
        (error) => {
          setFailedScripts([...scripts]);
          console.error('Falha ao aplicar o lote de scripts:', error);
        }
      );
    }
  }, [confirmBulkScripts, executeBatch]);

  const clearFailures = useCallback(() => {
    setFailedScripts([]);
  }, []);

  return {
    state,
    categoryScripts,
    activeExecution,
    batch,
    failedScripts,
    handleExecute,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
    handleApply,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    clearFailures,
    reloadScripts,
  };
}
