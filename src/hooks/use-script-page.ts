import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useScriptContext } from '../contexts/ScriptContext';
import { useScriptExecutionContext } from '../contexts/ScriptExecutionContext';
import { useSettingsContext } from '../contexts/SettingsContext';

export function useScriptPage(categories: string | string[]) {
  const { state, filteredScripts, setCategoryFilter, setSubcategoryFilter } = useScriptContext();
  const { activeExecution, execute, cancel } = useScriptExecutionContext();
  const { settings } = useSettingsContext();
  const [confirmScript, setConfirmScript] = useState<ScriptEntry | null>(null);

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

  return {
    state,
    categoryScripts,
    activeExecution,
    handleExecute,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  };
}
