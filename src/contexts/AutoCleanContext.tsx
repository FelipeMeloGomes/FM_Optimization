import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AutoCleanRunResult,
  AutoCleanSettings,
  AutoCleanStatus,
  ElevatedLaunchResult,
} from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { cleanerName } from '../lib/cleaner-options';
import { useSettingsContext } from './SettingsContext';

interface AutoCleanContextValue {
  status: AutoCleanStatus | null;
  updateConfig: (partial: Partial<AutoCleanSettings>) => void;
  runNow: (cleanerIds: string[]) => Promise<AutoCleanRunResult>;
  runPending: () => Promise<AutoCleanRunResult>;
  discard: (cleanerIds: string[]) => Promise<void>;
  relaunchAsAdmin: () => Promise<ElevatedLaunchResult>;
}

const AutoCleanContext = createContext<AutoCleanContextValue | null>(null);

function describeResult(result: AutoCleanRunResult): string {
  const parts: string[] = [];
  if (result.ran.length > 0) parts.push(`Executadas: ${result.ran.map(cleanerName).join(', ')}`);
  if (result.pending.length > 0) {
    parts.push(`Aguardando admin: ${result.pending.map(cleanerName).join(', ')}`);
  }
  if (result.failed.length > 0)
    parts.push(`Falharam: ${result.failed.map(cleanerName).join(', ')}`);
  return parts.join(' · ');
}

export function AutoCleanProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AutoCleanStatus | null>(null);
  const { settings, update } = useSettingsContext();
  const soundEnabled = settings.soundEnabled;

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.electronAPI.getAutoCleanStatus());
    } catch (error) {
      console.error('Falha ao ler estado da limpeza automática:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const offStatus = window.electronAPI.onAutoCleanStatus(setStatus);
    const offFinished = window.electronAPI.onAutoCleanFinished((result) => {
      const description = describeResult(result);
      if (!description) return;
      const type = result.failed.length > 0 ? 'warning' : 'success';
      showEnhancedToast({
        type,
        title: result.pending.length > 0 ? 'Limpeza automática parcial' : 'Limpeza automática',
        description,
        duration: 'long',
        sound: soundEnabled,
      });
    });
    return () => {
      offStatus();
      offFinished();
    };
  }, [soundEnabled]);

  // Mantém o estado do renderer alinhado com o que o main aceitou. Salvar apenas
  // na config evita que a próxima alteração de tema sobrescreva o agendamento.
  // O setStatus otimista garante que dois cliques seguidos não se anulem antes
  // do broadcast de confirmação do main.
  const updateConfig = useCallback(
    (partial: Partial<AutoCleanSettings>) => {
      setStatus((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...partial } } : prev));
      const current = status;
      if (!current) return;
      const autoClean: AutoCleanSettings = { ...current.settings, ...partial };
      update({ autoClean });
    },
    [status, update]
  );

  const runNow = useCallback(
    async (cleanerIds: string[]) => {
      const result = await window.electronAPI.runCleanerNow(cleanerIds);
      await refresh();
      return result;
    },
    [refresh]
  );

  const runPending = useCallback(async () => {
    const result = await window.electronAPI.runAutoCleanPending();
    await refresh();
    return result;
  }, [refresh]);

  const discard = useCallback(async (cleanerIds: string[]) => {
    const next = await window.electronAPI.discardPendingCleaners(cleanerIds);
    setStatus(next);
  }, []);

  const relaunchAsAdmin = useCallback(async () => {
    const result = await window.electronAPI.elevateApp(undefined, undefined, undefined, true);
    if (!result.launched) {
      showEnhancedToast({
        type: result.cancelled ? 'info' : 'error',
        title: result.cancelled ? 'Elevação cancelada' : 'Não foi possível elevar',
        description: result.cancelled
          ? 'As pendências continuam aguardando.'
          : (result.error ?? 'Tente novamente.'),
        duration: 'long',
        sound: soundEnabled,
      });
    }
    return result;
  }, [soundEnabled]);

  const value = useMemo(
    () => ({
      status,
      updateConfig,
      runNow,
      runPending,
      discard,
      relaunchAsAdmin,
    }),
    [status, updateConfig, runNow, runPending, discard, relaunchAsAdmin]
  );

  return <AutoCleanContext.Provider value={value}>{children}</AutoCleanContext.Provider>;
}

export function useAutoCleanContext(): AutoCleanContextValue {
  const ctx = useContext(AutoCleanContext);
  if (!ctx) throw new Error('useAutoCleanContext must be used within AutoCleanProvider');
  return ctx;
}
