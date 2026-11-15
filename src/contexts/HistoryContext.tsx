import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { AsyncState, ExecutionHistoryEntry } from '../../electron/shared/ipc-types';
import { useSettingsContext } from './SettingsContext';

interface HistoryContextValue {
  state: AsyncState<ExecutionHistoryEntry[]>;
  refresh: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AsyncState<ExecutionHistoryEntry[]>>({ status: 'loading' });
  const { settings } = useSettingsContext();

  const refresh = useCallback(() => {
    setState({ status: 'loading' });
    window.electronAPI
      .getExecutionHistory()
      .then((data) => setState({ status: 'success', data }))
      .catch((e) =>
        setState({ status: 'error', error: typeof e === 'string' ? e : (e as Error).message })
      );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // No power save mode: desabilita listener de script finalizado para reduzir polling
  useEffect(() => {
    if (settings.powerSaveMode) return;
    return window.electronAPI.onScriptEnded(() => {
      refresh();
    });
  }, [refresh, settings.powerSaveMode]);

  return <HistoryContext.Provider value={{ state, refresh }}>{children}</HistoryContext.Provider>;
}

export function useHistoryContext(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryContext must be used within HistoryProvider');
  return ctx;
}
