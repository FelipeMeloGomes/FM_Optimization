import { useCallback, useEffect, useState } from 'react';
import type { AppxInventory, AppxRemoveResult } from '../../electron/shared/ipc-types';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await window.electronAPI.getAppxInventory();
        if (cancelled) return;
        setInventory(data);
        setError(null);
        setLastRefreshed(Date.now());
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await window.electronAPI.getAppxInventory(true);
      setInventory(data);
      setError(null);
      setLastRefreshed(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const remove = useCallback(async (families: string[]): Promise<AppxRemoveResult> => {
    try {
      const result = await window.electronAPI.removeAppxPackages(families);
      const data = await window.electronAPI.getAppxInventory(true);
      setInventory(data);
      setError(null);
      setLastRefreshed(Date.now());
      return result;
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }, []);

  return { inventory, loading, error, isRefreshing, lastRefreshed, refresh, remove };
}
