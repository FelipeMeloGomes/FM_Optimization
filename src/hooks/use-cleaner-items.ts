import { useCallback, useEffect, useRef, useState } from 'react';
import type { CleanerItemId } from '../../electron/shared/cleaner-items';
import type { CleanerItemStats, CleanItemsResult } from '../../electron/shared/ipc-types';

const CACHE_KEY = 'fm-cleaner-items';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedData {
  items: CleanerItemStats[];
  timestamp: number;
}

function isCachedData(value: unknown): value is CachedData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CachedData>;
  return Array.isArray(candidate.items) && typeof candidate.timestamp === 'number';
}

function loadCache(): CleanerItemStats[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: unknown = JSON.parse(raw);
    if (!isCachedData(cached)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.items;
  } catch {
    return null;
  }
}

function saveCache(items: CleanerItemStats[]): void {
  try {
    const data: CachedData = { items, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // quota cheia: o cache é só conveniência
  }
}

import { toErrorMessage } from '../../electron/shared/errors';
import { useLatestRequest } from './use-latest-request';

/**
 * Estatísticas por item da página de limpeza, com cache de 5 minutos para a
 * tela não piscar a cada navegação. A varredura roda uma vez por item no main —
 * diferente do modelo antigo, em que a "Limpeza Total" revarria tudo.
 */
export function useCleanerItems() {
  const cached = useRef(loadCache());
  const [items, setItems] = useState<CleanerItemStats[]>(cached.current ?? []);
  const [loading, setLoading] = useState(!cached.current);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number>(cached.current ? Date.now() : 0);
  const { next, isCurrent, invalidate } = useLatestRequest();

  useEffect(() => {
    const request = next();

    async function init() {
      try {
        const fresh = await window.electronAPI.getCleanerItemsStats();
        if (!isCurrent(request)) return;
        setItems(fresh);
        setError(null);
        saveCache(fresh);
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
      const fresh = await window.electronAPI.getCleanerItemsStats();
      if (!isCurrent(request)) return;
      setItems(fresh);
      setError(null);
      saveCache(fresh);
      setLastRefreshed(Date.now());
    } catch (e) {
      if (isCurrent(request)) setError(toErrorMessage(e));
    } finally {
      if (isCurrent(request)) setIsRefreshing(false);
    }
  }, [isCurrent, next]);

  const clean = useCallback(async (ids: CleanerItemId[]): Promise<CleanItemsResult> => {
    return window.electronAPI.cleanItems(ids);
  }, []);

  return { items, loading, error, isRefreshing, lastRefreshed, refresh, clean };
}
