import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import type { AsyncState, RestorePointEntry } from '../../electron/shared/ipc-types';
import { useLatestRequest } from '../hooks/use-latest-request';

interface RestorePointContextValue {
  state: AsyncState<RestorePointEntry[]>;
  creating: boolean;
  restoring: boolean;
  isAdmin: boolean;
  adminRequired: boolean;
  refresh: () => void;
  hasFetched: boolean;
  create: (name: string) => Promise<void>;
  remove: (seq: number) => Promise<void>;
  restore: (seq: number) => Promise<void>;
}

const RestorePointContext = createContext<RestorePointContextValue | null>(null);

function isAdminRequiredError(e: unknown): boolean {
  const msg = typeof e === 'string' ? e : ((e as Error)?.message ?? '');
  return /access\s*denied|acesso|administrador|admin|unauthorized|managementexception/i.test(msg);
}

export function RestorePointProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AsyncState<RestorePointEntry[]>>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRequired, setAdminRequired] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const fetchRef = useRef(false);
  const { next, isCurrent } = useLatestRequest();

  const refresh = useCallback(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    const request = next();
    setHasFetched(true);
    setState({ status: 'loading' });
    Promise.all([window.electronAPI.getRestorePoints(), window.electronAPI.isAdmin()])
      .then(([data, admin]) => {
        if (!isCurrent(request)) return;
        setState({ status: 'success', data });
        setIsAdmin(admin);
      })
      .catch((e) => {
        if (!isCurrent(request)) return;
        const admin = isAdminRequiredError(e);
        setAdminRequired(admin);
        setState({ status: 'error', error: typeof e === 'string' ? e : (e as Error).message });
      })
      .finally(() => {
        if (isCurrent(request)) fetchRef.current = false;
      });
  }, [isCurrent, next]);

  const create = useCallback(
    async (name: string) => {
      setCreating(true);
      try {
        await window.electronAPI.createRestorePoint(name);
        await refresh();
      } catch (e) {
        const admin = isAdminRequiredError(e);
        setAdminRequired(admin);
        setState({
          status: 'error',
          error: typeof e === 'string' ? e : 'Falha ao excluir ponto de restauração',
        });
      } finally {
        setCreating(false);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (seq: number) => {
      try {
        await window.electronAPI.deleteRestorePoint(seq);
        await refresh();
      } catch (e) {
        const admin = isAdminRequiredError(e);
        setAdminRequired(admin);
        setState({
          status: 'error',
          error: typeof e === 'string' ? e : 'Falha ao excluir ponto de restauração',
        });
      }
    },
    [refresh]
  );

  const restore = useCallback(
    async (seq: number) => {
      setRestoring(true);
      try {
        await window.electronAPI.restoreSystem(seq);
        await refresh();
      } catch (e) {
        const admin = isAdminRequiredError(e);
        setAdminRequired(admin);
        setState({
          status: 'error',
          error: typeof e === 'string' ? e : 'Falha ao restaurar o sistema',
        });
      } finally {
        setRestoring(false);
      }
    },
    [refresh]
  );

  return (
    <RestorePointContext.Provider
      value={{
        state,
        creating,
        restoring,
        isAdmin,
        adminRequired,
        refresh,
        hasFetched,
        create,
        remove,
        restore,
      }}
    >
      {children}
    </RestorePointContext.Provider>
  );
}

export function useRestorePointContext(): RestorePointContextValue {
  const ctx = useContext(RestorePointContext);
  if (!ctx) throw new Error('useRestorePointContext must be used within RestorePointProvider');
  return ctx;
}
