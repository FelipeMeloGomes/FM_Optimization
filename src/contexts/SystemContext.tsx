import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  hasFetched: boolean;
}

function createSectionProvider<T>(fetchData: () => Promise<T>, contextName: string) {
  const Context = createContext<SectionContextValue<T> | null>(null);

  // biome-ignore lint/correctness/noComponentHookFactories: Provider é estável por seção
  function Provider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
    const [refreshing, setRefreshing] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const fetchRef = useRef(false);

    const refresh = useCallback(() => {
      if (fetchRef.current) return;
      fetchRef.current = true;
      setHasFetched(true);
      setRefreshing(true);
      fetchData()
        .then((data) => setState({ status: 'success', data }))
        .catch((e: unknown) =>
          setState({
            status: 'error',
            error: typeof e === 'string' ? e : (e as Error).message,
          })
        )
        .finally(() => {
          setRefreshing(false);
          fetchRef.current = false;
        });
    }, []);

    return (
      <Context.Provider value={{ state, refreshing, refresh, hasFetched }}>
        {children}
      </Context.Provider>
    );
  }

  // biome-ignore lint/correctness/noComponentHookFactories: hook identity é estável por seção
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
  hasFetched: boolean;
  isFromCache: boolean;
}

const SystemContext = createContext<SystemContextValue | null>(null);

// Module-level ref to track if fetch has been initiated across StrictMode remounts
const systemInfoFetchedRef = { current: false };

export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AsyncState<DashboardData>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const fetchRef = useRef(false);

  const refresh = useCallback(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    setHasFetched(true);
    const isInitialLoad = state.status === 'loading';
    if (!isInitialLoad) setRefreshing(true);
    setIsFromCache(false);

    window.electronAPI
      .getSystemInfo()
      .then((data) => setState({ status: 'success', data }))
      .catch((e: unknown) =>
        setState({ status: 'error', error: typeof e === 'string' ? e : (e as Error).message })
      )
      .finally(() => {
        setRefreshing(false);
        fetchRef.current = false;
      });
  }, [state.status]);

  // Carrega cache na inicialização (evita dupla execução no StrictMode)
  useEffect(() => {
    if (systemInfoFetchedRef.current) return;
    systemInfoFetchedRef.current = true;

    const mounted = true;
    window.electronAPI
      .getSystemInfoCache()
      .then((cache) => {
        if (!mounted) return;
        if (cache?.data) {
          setState({ status: 'success', data: cache.data });
          setIsFromCache(true);
        }
      })
      .catch(() => {
        /* cache não disponível ou corrompido: ignora */
      });
  }, []);

  return (
    <SystemContext.Provider value={{ state, refreshing, refresh, hasFetched, isFromCache }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystemContext(): SystemContextValue {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystemContext must be used within SystemProvider');
  return ctx;
}
