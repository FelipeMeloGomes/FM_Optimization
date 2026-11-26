import { useCallback, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import type { StartupSetEnabledPayload } from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useAsyncData } from './use-async-data';

export function useStartup() {
  const { settings } = useSettingsContext();
  const { state, reload, setData } = useAsyncData(() => window.electronAPI.startupList());
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const toggle = useCallback(
    async (payload: StartupSetEnabledPayload, label: string) => {
      setBusy((prev) => ({ ...prev, [payload.id]: true }));
      try {
        const data = await window.electronAPI.startupSetEnabled(payload);
        setData(() => data);
        showEnhancedToast({
          type: payload.enabled ? 'success' : 'warning',
          title: payload.enabled ? `${label} reativado` : `${label} desativado`,
          description: payload.enabled
            ? 'Voltará a abrir com o Windows.'
            : 'Não abre mais junto com o Windows. Você pode reativar quando quiser.',
          sound: settings.soundEnabled,
        });
        return true;
      } catch (error: unknown) {
        showEnhancedToast({
          type: 'error',
          title: 'Não foi possível alterar',
          description: toErrorMessage(error),
        });
        return false;
      } finally {
        setBusy((prev) => {
          const next = { ...prev };
          delete next[payload.id];
          return next;
        });
      }
    },
    [settings.soundEnabled, setData]
  );

  const stopService = useCallback(
    async (id: string, label: string) => {
      setBusy((prev) => ({ ...prev, [id]: true }));
      try {
        const data = await window.electronAPI.startupStopService({ id });
        setData(() => data);
        showEnhancedToast({
          type: 'success',
          title: `${label} parado`,
          description: 'O serviço continua configurado; só foi interrompido agora.',
          sound: settings.soundEnabled,
        });
        return true;
      } catch (error: unknown) {
        showEnhancedToast({
          type: 'error',
          title: 'Não foi possível parar o serviço',
          description: toErrorMessage(error),
        });
        return false;
      } finally {
        setBusy((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [settings.soundEnabled, setData]
  );

  const openLocation = useCallback(async (id: string) => {
    try {
      await window.electronAPI.startupOpenLocation({ id });
    } catch (error: unknown) {
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível abrir o local',
        description: toErrorMessage(error),
      });
    }
  }, []);

  const elevate = useCallback(() => {
    window.electronAPI.elevateApp(undefined, undefined, undefined, true).catch((error: unknown) =>
      showEnhancedToast({
        type: 'error',
        title: 'Falha ao reiniciar como administrador',
        description: toErrorMessage(error),
      })
    );
  }, []);

  return { state, reload, toggle, stopService, openLocation, elevate, busy };
}
