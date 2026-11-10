import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AsyncState,
  CpuInfo,
  DashboardData,
  MemoryInfo,
} from '../../electron/shared/ipc-types';

interface SectionContextValue<T> {
  state: AsyncState<T>;
  refreshing: boolean;
  refresh: () => void;
}

function createSectionProvider<T>(fetchData: () => Promise<T>, contextName: string) {
  const Context = createContext<SectionContextValue<T> | null>(null);

  // biome-ignore lint: criado uma única vez por seção, então a identidade é estável
  function Provider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(() => {
      if (state.status !== 'loading') setRefreshing(true);
      fetchData()
        .then((data) => setState({ status: 'success', data }))
        .catch((e: unknown) =>
          setState({
            status: 'error',
            error: typeof e === 'string' ? e : (e as Error).message,
          })
        )
        .finally(() => setRefreshing(false));
    }, [state.status]);

    useEffect(() => {
      refresh();
    }, [refresh]);

    return <Context.Provider value={{ state, refreshing, refresh }}>{children}</Context.Provider>;
  }

  // biome-ignore lint: idem, cada seção registra seu hook uma única vez
  function useSectionContext(): SectionContextValue<T> {
    const ctx = useContext(Context);
    if (!ctx) throw new Error(`${contextName} must be used within its Provider`);
    return ctx;
  }

  return { Provider, useSectionContext };
}

// CPU
const CpuSection = createSectionProvider<CpuInfo>(
  () => window.electronAPI.getCpuInfo(),
  'useCpuContext'
);
export const CpuProvider = CpuSection.Provider;
export const useCpuContext = CpuSection.useSectionContext;

// Memory
const MemorySection = createSectionProvider<MemoryInfo>(
  () => window.electronAPI.getMemoryInfo(),
  'useMemoryContext'
);
export const MemoryProvider = MemorySection.Provider;
export const useMemoryContext = MemorySection.useSectionContext;

// Legacy aggregate (usado pelo Dashboard) — mantém compatibilidade
interface SystemContextValue {
  state: AsyncState<DashboardData>;
  refreshing: boolean;
  refresh: () => void;
}

const SystemContext = createContext<SystemContextValue | null>(null);

export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AsyncState<DashboardData>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    const isInitialLoad = state.status === 'loading';
    if (!isInitialLoad) setRefreshing(true);

    window.electronAPI
      .getSystemInfo()
      .then((data) => setState({ status: 'success', data }))
      .catch((e: unknown) =>
        setState({ status: 'error', error: typeof e === 'string' ? e : (e as Error).message })
      )
      .finally(() => setRefreshing(false));
  }, [state.status]);

  useEffect(() => {
    refresh();
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SystemContext.Provider value={{ state, refreshing, refresh }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystemContext(): SystemContextValue {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystemContext must be used within SystemProvider');
  return ctx;
}
