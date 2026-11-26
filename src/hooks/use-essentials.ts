import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import type {
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
} from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useAsyncData } from './use-async-data';

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function useEssentials() {
  const { settings } = useSettingsContext();
  const { state, reload } = useAsyncData(() => window.electronAPI.getEssentials());
  const [installProgress, setInstallProgress] = useState<Record<string, EssentialInstallProgress>>(
    {}
  );
  const [installs, setInstalls] = useState<Record<string, EssentialInstallResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return window.electronAPI.onEssentialInstallProgress((data) => {
      setInstallProgress((prev) => ({ ...prev, [data.id]: data }));
    });
  }, []);

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
        const message = toErrorMessage(error);
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
