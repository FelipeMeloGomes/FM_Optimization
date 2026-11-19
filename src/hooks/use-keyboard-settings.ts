import { useCallback, useEffect, useState } from 'react';
import type { AsyncState } from '../../electron/shared/ipc-types';
import {
  DEFAULT_KEYBOARD_SETTINGS,
  type KeyboardSettings,
} from '../../electron/shared/keyboard-settings';

export interface UseKeyboardSettingsResult {
  state: AsyncState<KeyboardSettings>;
  draft: KeyboardSettings | null;
  isDirty: boolean;
  applyError: string | null;
  appliedAt: string | null;
  update: (patch: Partial<KeyboardSettings>) => void;
  apply: (settings?: KeyboardSettings) => Promise<void>;
  reset: () => void;
  discard: () => void;
  reload: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameSettings(a: KeyboardSettings, b: KeyboardSettings): boolean {
  return (
    a.repeatDelay === b.repeatDelay &&
    a.repeatRate === b.repeatRate &&
    a.caretBlinkRate === b.caretBlinkRate
  );
}

/** Lê os ajustes reais do Windows e só aplica quando o usuário confirmar. */
export function useKeyboardSettings(): UseKeyboardSettingsResult {
  const [state, setState] = useState<AsyncState<KeyboardSettings>>({ status: 'loading' });
  const [draft, setDraft] = useState<KeyboardSettings | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    setApplyError(null);
    try {
      const api = window.electronAPI;
      if (!api?.getKeyboardSettings) {
        throw new Error('API de configurações do teclado indisponível');
      }
      const settings = await api.getKeyboardSettings();
      setState({ status: 'success', data: settings });
      setDraft(settings);
    } catch (error) {
      setState({ status: 'error', error: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback((patch: Partial<KeyboardSettings>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setApplyError(null);
  }, []);

  const apply = useCallback(
    async (settings?: KeyboardSettings) => {
      const target = settings ?? draft;
      if (!target) return;
      setApplyError(null);
      try {
        const api = window.electronAPI;
        if (!api?.applyKeyboardSettings) {
          throw new Error('API de configurações do teclado indisponível');
        }
        const saved = await api.applyKeyboardSettings(target);
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
    setDraft({ ...DEFAULT_KEYBOARD_SETTINGS });
    setApplyError(null);
  }, []);

  const discard = useCallback(() => {
    setDraft(state.status === 'success' ? state.data : null);
    setApplyError(null);
  }, [state]);

  const isDirty = draft !== null && state.status === 'success' && !sameSettings(draft, state.data);

  return { state, draft, isDirty, applyError, appliedAt, update, apply, reset, discard, reload };
}
