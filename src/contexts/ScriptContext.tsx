import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

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
  const [state, setState] = useState<AsyncState<ScriptEntry[]>>({ status: 'loading' });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const requestRef = useRef(0);

  const loadScripts = useCallback(() => {
    const request = ++requestRef.current;
    setState({ status: 'loading' });
    window.electronAPI
      .getScripts()
      .then((scripts) => {
        if (requestRef.current === request) setState({ status: 'success', data: scripts });
      })
      .catch((e) => {
        if (requestRef.current === request) {
          setState({ status: 'error', error: typeof e === 'string' ? e : (e as Error).message });
        }
      });
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

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
      retry: loadScripts,
    }),
    [state, filteredScripts, categoryFilter, subcategoryFilter, subcategories, loadScripts]
  );

  return <ScriptContext.Provider value={contextValue}>{children}</ScriptContext.Provider>;
}

export function useScriptContext(): ScriptContextValue {
  const ctx = useContext(ScriptContext);
  if (!ctx) throw new Error('useScriptContext must be used within ScriptProvider');
  return ctx;
}
