import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import { showEnhancedToast } from '../components/EnhancedToast';

export interface UseAdminStatusOptions {
  soundEnabled: boolean;
  /** Status já conhecido pela página (ex.: inventário Appx); dispensa a consulta via IPC. */
  externalIsAdmin?: boolean;
}

/** Status de administrador e relançamento elevado, no padrão das páginas de tweaks. */
export function useAdminStatus({ soundEnabled, externalIsAdmin }: UseAdminStatusOptions) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(externalIsAdmin ?? null);
  const [elevating, setElevating] = useState(false);

  useEffect(() => {
    if (externalIsAdmin !== undefined) {
      setIsAdmin(externalIsAdmin);
      return;
    }

    let cancelled = false;
    window.electronAPI
      .isAdmin()
      .then((value) => {
        if (!cancelled) setIsAdmin(value);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [externalIsAdmin]);

  const relaunchAsAdmin = useCallback(async () => {
    setElevating(true);
    try {
      await window.electronAPI.elevateApp(undefined, undefined, undefined, true);
    } catch (error) {
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível reiniciar como admin',
        description: toErrorMessage(error),
        duration: 'long',
        sound: soundEnabled,
      });
    } finally {
      setElevating(false);
    }
  }, [soundEnabled]);

  return { isAdmin, elevating, relaunchAsAdmin };
}
