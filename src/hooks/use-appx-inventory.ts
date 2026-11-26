import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import type { AppxInventory, AppxRemoveResult } from '../../electron/shared/ipc-types';
import { useLatestRequest } from './use-latest-request';

/**
 * Inventário Appx da página Debloat.
 *
 * A varredura é lenta (Get-AppxPackage -AllUsers + provisionados), então o main
 * mantém cache de 60s e `refresh()` pede uma nova varredura. A remoção roda no
 * main e, ao terminar, a lista é relida para refletir o que realmente saiu.
 */
export function useAppxInventory() {
  const [inventory, setInventory] = useState<AppxInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(0);
  const { next, isCurrent, invalidate } = useLatestRequest();

  useEffect(() => {
    const request = next();

    async function init() {
      try {
        const data = await window.electronAPI.getAppxInventory();
        if (!isCurrent(request)) return;
        setInventory(data);
        setError(null);
        setLastRefreshed(Date.now());
      } catch (e) {
        if (!isCurrent(request)) return;
        setError(toErrorMessage(e));
      } finally {
        if (isCurrent(request)) setLoading(false);
      }
    }

    void init();

    return () => {
      invalidate();
    };
  }, [invalidate, isCurrent, next]);

  const refresh = useCallback(async () => {
    const request = next();
    setIsRefreshing(true);
    try {
      const data = await window.electronAPI.getAppxInventory(true);
      if (!isCurrent(request)) return;
      setInventory(data);
      setError(null);
      setLastRefreshed(Date.now());
    } catch (e) {
      if (isCurrent(request)) setError(toErrorMessage(e));
    } finally {
      if (isCurrent(request)) setIsRefreshing(false);
    }
  }, [isCurrent, next]);

  const remove = useCallback(
    async (families: string[]): Promise<AppxRemoveResult> => {
      const request = next();
      try {
        const result = await window.electronAPI.removeAppxPackages(families);
        const data = await window.electronAPI.getAppxInventory(true);
        if (isCurrent(request)) {
          setInventory(data);
          setError(null);
          setLastRefreshed(Date.now());
        }
        return result;
      } catch (e) {
        if (isCurrent(request)) setError(toErrorMessage(e));
        throw e;
      }
    },
    [isCurrent, next]
  );

  return { inventory, loading, error, isRefreshing, lastRefreshed, refresh, remove };
}
