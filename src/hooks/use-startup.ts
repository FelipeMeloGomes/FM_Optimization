import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AsyncState,
  StartupSetEnabledPayload,
  StartupSnapshot,
} from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { useSettingsContext } from '../contexts/SettingsContext';

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useStartup() {
  const { settings } = useSettingsContext();
  const [state, setState] = useState<AsyncState<StartupSnapshot>>({ status: 'loading' });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setState({ status: 'loading' });

    try {
      const data = await window.electronAPI.startupList();
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

  const reload = useCallback(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (payload: StartupSetEnabledPayload, label: string) => {
      setBusy((prev) => ({ ...prev, [payload.id]: true }));
      try {
        const data = await window.electronAPI.startupSetEnabled(payload);
        setState({ status: 'success', data });
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
          description: errorMessage(error),
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
    [settings.soundEnabled]
  );

  const stopService = useCallback(
    async (id: string, label: string) => {
      setBusy((prev) => ({ ...prev, [id]: true }));
      try {
        const data = await window.electronAPI.startupStopService({ id });
        setState({ status: 'success', data });
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
          description: errorMessage(error),
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
    [settings.soundEnabled]
  );

  const openLocation = useCallback(async (id: string) => {
    try {
      await window.electronAPI.startupOpenLocation({ id });
    } catch (error: unknown) {
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível abrir o local',
        description: errorMessage(error),
      });
    }
  }, []);

  const elevate = useCallback(() => {
    window.electronAPI.elevateApp(undefined, undefined, undefined, true).catch((error: unknown) =>
      showEnhancedToast({
        type: 'error',
        title: 'Falha ao reiniciar como administrador',
        description: errorMessage(error),
      })
    );
  }, []);

  return { state, reload, toggle, stopService, openLocation, elevate, busy };
}
