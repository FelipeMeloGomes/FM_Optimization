import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Seleção múltipla de tweaks dentro de uma página: guarda os ids marcados e
 * descarta os que deixam de estar visíveis quando os filtros mudam.
 */
export function useScriptSelection(availableScripts: ScriptEntry[]) {
  const availableIds = useMemo(() => availableScripts.map((s) => s.id), [availableScripts]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const available = new Set(availableIds);
    setSelectedIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (available.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      // Devolver o mesmo Set quando nada saiu evita um re-render inútil.
      return changed ? next : current;
    });
  }, [availableIds]);

  const selectedScripts = useMemo(
    () => availableScripts.filter((s) => selectedIds.has(s.id)),
    [availableScripts, selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(availableIds));
  }, [availableIds]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const allSelected = availableIds.length > 0 && availableIds.every((id) => selectedIds.has(id));

  return {
    selectedIds,
    selectedScripts,
    availableIds,
    allSelected,
    toggle,
    selectAll,
    clear,
    isSelected,
  };
}
