import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import type { AsyncState, DashboardData, StorageDrive } from '../../electron/shared/ipc-types';
import { useSystemContext } from '../contexts/SystemContext';

export interface UseStorageDrivesResult {
  state: AsyncState<DashboardData>;
  drives: StorageDrive[];
  selected: Set<string>;
  optimizeFlags: Set<string>;
  busy: Set<string>;
  errors: Record<string, string>;
  applied: Record<string, boolean>;
  refresh: () => void;
  toggleSelected: (letter: string) => void;
  toggleOptimize: (letter: string) => void;
  cleanup: (letter: string) => Promise<void>;
  optimize: (letter: string) => Promise<void>;
  cleanupSelected: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeLetter(letter: string): string {
  return letter.toUpperCase();
}

/** `StorageDrive.letter` vem do WMI como `C:`; o IPC aceita só a letra (`^[A-Za-z]$`). */
function toIpcLetter(letter: string): string {
  return normalizeLetter(letter).replace(/:$/, '');
}

function toggleIn(setter: Dispatch<SetStateAction<Set<string>>>, letter: string): void {
  const key = normalizeLetter(letter);
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

/**
 * Estado das unidades e das ações por disco. A leitura vem do mesmo contexto
 * do Início — aqui só vivem seleção, flags e o resultado das ações.
 */
export function useStorageDrives(): UseStorageDrivesResult {
  const { state, refresh, hasFetched } = useSystemContext();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [optimizeFlags, setOptimizeFlags] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!hasFetched) refresh();
  }, [hasFetched, refresh]);

  const drives = state.status === 'success' ? state.data.drives : [];

  const toggleSelected = useCallback((letter: string) => {
    toggleIn(setSelected, letter);
  }, []);

  const toggleOptimize = useCallback((letter: string) => {
    toggleIn(setOptimizeFlags, letter);
  }, []);

  const runAction = useCallback(
    async (letter: string, action: 'cleanup' | 'optimize') => {
      const key = normalizeLetter(letter);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setBusy((prev) => new Set(prev).add(key));
      try {
        if (action === 'cleanup') {
          await window.electronAPI.runDiskCleanup(toIpcLetter(letter));
        } else {
          await window.electronAPI.optimizeDrive(toIpcLetter(letter));
        }
        setApplied((prev) => ({ ...prev, [key]: true }));
        refresh();
      } catch (error) {
        setErrors((prev) => ({ ...prev, [key]: errorMessage(error) }));
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [refresh]
  );

  const cleanup = useCallback((letter: string) => runAction(letter, 'cleanup'), [runAction]);
  const optimize = useCallback((letter: string) => runAction(letter, 'optimize'), [runAction]);

  const cleanupSelected = useCallback(async () => {
    const letters = [...selected];
    for (const letter of letters) {
      await cleanup(letter);
    }
    for (const letter of letters) {
      if (!optimizeFlags.has(letter)) continue;
      const drive = drives.find((item) => normalizeLetter(item.letter) === letter);
      if (drive?.type.startsWith('SSD')) {
        await optimize(letter);
      }
    }
  }, [selected, optimizeFlags, drives, cleanup, optimize]);

  return {
    state,
    drives,
    selected,
    optimizeFlags,
    busy,
    errors,
    applied,
    refresh,
    toggleSelected,
    toggleOptimize,
    cleanup,
    optimize,
    cleanupSelected,
  };
}
