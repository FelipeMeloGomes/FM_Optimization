import { useCallback, useEffect, useState } from 'react';
import type { AsyncState } from '../../electron/shared/ipc-types';
import { DEFAULT_MOUSE_SETTINGS, type MouseSettings } from '../../electron/shared/mouse-settings';

export interface UseMouseSettingsResult {
  state: AsyncState<MouseSettings>;
  /** Valores editados pelo usuário, antes de serem aplicados ao Windows. */
  draft: MouseSettings | null;
  isDirty: boolean;
  applyError: string | null;
  appliedAt: string | null;
  update: (patch: Partial<MouseSettings>) => void;
  apply: (settings?: MouseSettings) => Promise<void>;
  reset: () => void;
  discard: () => void;
  reload: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameSettings(a: MouseSettings, b: MouseSettings): boolean {
  return (
    a.pointerSpeed === b.pointerSpeed &&
    a.enhancedPrecision === b.enhancedPrecision &&
    a.doubleClickSpeed === b.doubleClickSpeed
  );
}

/**
 * Lê as configurações reais do Windows e mantém um rascunho separado: mexer
 * nos controles não altera o sistema até o usuário clicar em "Aplicar".
 */
export function useMouseSettings(): UseMouseSettingsResult {
  const [state, setState] = useState<AsyncState<MouseSettings>>({ status: 'loading' });
  const [draft, setDraft] = useState<MouseSettings | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    setApplyError(null);
    try {
      const api = window.electronAPI;
      if (!api?.getMouseSettings) {
        throw new Error('API de configurações do mouse indisponível');
      }
      const settings = await api.getMouseSettings();
      setState({ status: 'success', data: settings });
      setDraft(settings);
    } catch (error) {
      setState({ status: 'error', error: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback((patch: Partial<MouseSettings>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setApplyError(null);
  }, []);

  const apply = useCallback(
    async (settings?: MouseSettings) => {
      const target = settings ?? draft;
      if (!target) return;
      setApplyError(null);
      try {
        const api = window.electronAPI;
        if (!api?.applyMouseSettings) {
          throw new Error('API de configurações do mouse indisponível');
        }
        const saved = await api.applyMouseSettings(target);
        setState({ status: 'success', data: saved });
        setDraft(saved);
        setAppliedAt(new Date().toISOString());
      } catch (error) {
        setApplyError(errorMessage(error));
      }
    },
    [draft]
  );

  const reset = useCallback(() => {
    setDraft({ ...DEFAULT_MOUSE_SETTINGS });
    setApplyError(null);
  }, []);

  const discard = useCallback(() => {
    setDraft(state.status === 'success' ? state.data : null);
    setApplyError(null);
  }, [state]);

  const isDirty = draft !== null && state.status === 'success' && !sameSettings(draft, state.data);

  return { state, draft, isDirty, applyError, appliedAt, update, apply, reset, discard, reload };
}
