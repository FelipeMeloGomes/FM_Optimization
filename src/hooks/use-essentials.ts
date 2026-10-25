import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AsyncState,
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
} from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { useSettingsContext } from '../contexts/SettingsContext';

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function useEssentials() {
  const { settings } = useSettingsContext();
  const [state, setState] = useState<AsyncState<EssentialListItem[]>>({ status: 'loading' });
  const requestId = useRef(0);
  const [installProgress, setInstallProgress] = useState<Record<string, EssentialInstallProgress>>(
    {}
  );
  const [installs, setInstalls] = useState<Record<string, EssentialInstallResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setState({ status: 'loading' });

    try {
      const data = await window.electronAPI.getEssentials();
      if (requestId.current === current) setState({ status: 'success', data });
    } catch (error: unknown) {
      if (requestId.current === current) {
        setState({ status: 'error', error: errorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    return window.electronAPI.onEssentialInstallProgress((data) => {
      setInstallProgress((prev) => ({ ...prev, [data.id]: data }));
    });
  }, []);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  const install = useCallback(
    async (item: EssentialListItem) => {
      setErrors((prev) => withoutKey(prev, item.id));
      setRunning((prev) => ({ ...prev, [item.id]: true }));

      try {
        const result = await window.electronAPI.installEssential(item.id);
        setInstalls((prev) => ({ ...prev, [item.id]: result }));

        if (result.alreadyInstalled) {
          showEnhancedToast({
            type: 'info',
            title: `${item.name} já está instalado`,
            description: 'Nenhuma alteração foi feita neste PC.',
            sound: settings.soundEnabled,
          });
        } else {
          showEnhancedToast({
            type: 'success',
            title: `${item.name} instalado`,
            description: 'Instalado pelo winget, com o hash do manifesto verificado.',
            sound: settings.soundEnabled,
          });
        }
      } catch (error: unknown) {
        const message = errorMessage(error);
        if (message !== 'Instalação cancelada.') {
          setErrors((prev) => ({ ...prev, [item.id]: message }));
          showEnhancedToast({ type: 'error', title: 'Falha na instalação', description: message });
        }
      } finally {
        setRunning((prev) => ({ ...prev, [item.id]: false }));
        setInstallProgress((prev) => withoutKey(prev, item.id));
      }
    },
    [settings.soundEnabled]
  );

  const cancelInstall = useCallback((id: string) => {
    window.electronAPI.cancelEssentialInstall(id).catch(() => undefined);
  }, []);

  const openPage = useCallback((item: EssentialListItem) => {
    window.electronAPI.openEssentialPage(item.id).catch(() => undefined);
  }, []);

  return {
    state,
    reload,
    installProgress,
    installs,
    errors,
    running,
    install,
    cancelInstall,
    openPage,
  };
}
