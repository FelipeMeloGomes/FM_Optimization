import { useCallback, useEffect, useState } from 'react';
import type {
  DisplayMode,
  DisplayMonitor,
  DisplaySettings,
} from '../../electron/shared/display-settings';
import type { AsyncState } from '../../electron/shared/ipc-types';

export type DisplayDrafts = Record<string, DisplayMode>;

export interface UseDisplaySettingsResult {
  state: AsyncState<DisplaySettings>;
  monitors: DisplayMonitor[];
  /** Rascunho de cada monitor, indexado pelo deviceName. */
  drafts: DisplayDrafts;
  isDirty: (deviceName: string) => boolean;
  errors: Record<string, string>;
  applied: Record<string, boolean>;
  update: (deviceName: string, patch: Partial<DisplayMode>) => void;
  apply: (deviceName: string) => Promise<void>;
  discard: (deviceName: string) => void;
  reload: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentMode(monitor: DisplayMonitor): DisplayMode {
  return { width: monitor.width, height: monitor.height, frequency: monitor.frequency };
}

function sameMode(a: DisplayMode, b: DisplayMode): boolean {
  return a.width === b.width && a.height === b.height && a.frequency === b.frequency;
}

function draftsFrom(settings: DisplaySettings): DisplayDrafts {
  return Object.fromEntries(
    settings.monitors.map((monitor) => [monitor.deviceName, currentMode(monitor)])
  );
}

/**
 * Lê todos os monitores ativos e mantém um rascunho por dispositivo: escolher
 * outro modo não muda a tela até o usuário aplicar naquele monitor específico.
 */
export function useDisplaySettings(): UseDisplaySettingsResult {
  const [state, setState] = useState<AsyncState<DisplaySettings>>({ status: 'loading' });
  const [drafts, setDrafts] = useState<DisplayDrafts>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    setErrors({});
    try {
      const api = window.electronAPI;
      if (!api?.getDisplaySettings) {
        throw new Error('API de configurações do monitor indisponível');
      }
      const settings = await api.getDisplaySettings();
      setState({ status: 'success', data: settings });
      setDrafts(draftsFrom(settings));
    } catch (error) {
      setState({ status: 'error', error: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback((deviceName: string, patch: Partial<DisplayMode>) => {
    setDrafts((current) =>
      current[deviceName]
        ? { ...current, [deviceName]: { ...current[deviceName], ...patch } }
        : current
    );
    setErrors((current) => {
      if (!current[deviceName]) return current;
      const next = { ...current };
      delete next[deviceName];
      return next;
    });
    setApplied((current) => ({ ...current, [deviceName]: false }));
  }, []);

  const apply = useCallback(
    async (deviceName: string) => {
      const target = drafts[deviceName];
      if (!target) return;
      setErrors((current) => {
        const next = { ...current };
        delete next[deviceName];
        return next;
      });
      try {
        const api = window.electronAPI;
        if (!api?.applyDisplaySettings) {
          throw new Error('API de configurações do monitor indisponível');
        }
        const saved = await api.applyDisplaySettings({ deviceName, mode: target });
        setState({ status: 'success', data: saved });
        setDrafts(draftsFrom(saved));
        setApplied((current) => ({ ...current, [deviceName]: true }));
      } catch (error) {
        setErrors((current) => ({ ...current, [deviceName]: errorMessage(error) }));
      }
    },
    [drafts]
  );

  const discard = useCallback(
    (deviceName: string) => {
      if (state.status !== 'success') return;
      const monitor = state.data.monitors.find((item) => item.deviceName === deviceName);
      if (!monitor) return;
      setDrafts((current) => ({ ...current, [deviceName]: currentMode(monitor) }));
      setErrors((current) => {
        const next = { ...current };
        delete next[deviceName];
        return next;
      });
    },
    [state]
  );

  const isDirty = useCallback(
    (deviceName: string) => {
      if (state.status !== 'success') return false;
      const monitor = state.data.monitors.find((item) => item.deviceName === deviceName);
      const draft = drafts[deviceName];
      return Boolean(monitor && draft && !sameMode(draft, currentMode(monitor)));
    },
    [state, drafts]
  );

  const monitors = state.status === 'success' ? state.data.monitors : [];

  return { state, monitors, drafts, isDirty, errors, applied, update, apply, discard, reload };
}
