import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import { useAsyncData } from '../hooks/use-async-data';

interface ScriptContextValue {
  state: AsyncState<ScriptEntry[]>;
  filteredScripts: ScriptEntry[];
  categoryFilter: string;
  subcategoryFilter: string;
  subcategories: string[];
  setCategoryFilter: (c: string) => void;
  setSubcategoryFilter: (c: string) => void;
  /** Refaz a leitura do catálogo após uma falha. */
  retry: () => void;
}

const ScriptContext = createContext<ScriptContextValue | null>(null);

export function ScriptProvider({ children }: { children: ReactNode }) {
  const { state, reload } = useAsyncData(() => window.electronAPI.getScripts());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');

  const scripts = state.status === 'success' ? state.data : [];

  const subcategories = useMemo(() => {
    const cats = new Set<string>();
    scripts.forEach((s) => {
      if (s.subcategory && (!categoryFilter || s.category === categoryFilter)) {
        cats.add(s.subcategory);
      }
    });
    return Array.from(cats).sort();
  }, [scripts, categoryFilter]);

  const filteredScripts = useMemo(
    () =>
      scripts.filter((s) => {
        if (categoryFilter && s.category !== categoryFilter) return false;
        if (subcategoryFilter && s.subcategory !== subcategoryFilter) return false;
        return true;
      }),
    [scripts, categoryFilter, subcategoryFilter]
  );

  const contextValue = useMemo(
    () => ({
      state,
      filteredScripts,
      categoryFilter,
      subcategoryFilter,
      subcategories,
      setCategoryFilter,
      setSubcategoryFilter,
      retry: reload,
    }),
    [state, filteredScripts, categoryFilter, subcategoryFilter, subcategories, reload]
  );

  return <ScriptContext.Provider value={contextValue}>{children}</ScriptContext.Provider>;
}

export function useScriptContext(): ScriptContextValue {
  const ctx = useContext(ScriptContext);
  if (!ctx) throw new Error('useScriptContext must be used within ScriptProvider');
  return ctx;
}
