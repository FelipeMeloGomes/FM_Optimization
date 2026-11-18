import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { SpeedProgress, SpeedTestResult } from '../../electron/shared/ipc-types';

export type SpeedStatus = 'idle' | 'measuring' | 'done' | 'error';

export interface SpeedContextValue {
  status: SpeedStatus;
  progress: SpeedProgress;
  result: SpeedTestResult | null;
  error: string | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}

const INITIAL_PROGRESS: SpeedProgress = { phase: 'latency', progress: 0, currentMbps: null };

const SpeedContext = createContext<SpeedContextValue | null>(null);

export function SpeedProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SpeedStatus>('idle');
  const [progress, setProgress] = useState<SpeedProgress>(INITIAL_PROGRESS);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    const runId = ++runRef.current;
    setStatus('measuring');
    setProgress(INITIAL_PROGRESS);
    setResult(null);
    setError(null);

    const cleanup = window.electronAPI.onSpeedProgress((data) => {
      if (runRef.current === runId) setProgress(data);
    });
    cleanupRef.current = cleanup;

    try {
      const data = await window.electronAPI.measureSpeed();
      if (runRef.current !== runId) return;
      setResult(data);
      setStatus('done');
    } catch (e: unknown) {
      if (runRef.current !== runId) return;
      const message = typeof e === 'string' ? e : (e as Error).message;
      setError(message);
      // Uma falha no meio da medição não pode deixar a agulha travada no valor
      // da última amostra: o erro volta com o medidor zerado.
      setProgress(INITIAL_PROGRESS);
      setStatus('error');
    } finally {
      cleanup();
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    }
  }, []);

  const cancel = useCallback(async () => {
    // Invalida a medição em curso: a rejeição esperada do `measureSpeed` não
    // pode transformar um cancelamento em erro na tela.
    runRef.current++;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus('idle');
    setProgress(INITIAL_PROGRESS);
    setResult(null);
    setError(null);
    try {
      await window.electronAPI.cancelSpeedTest();
    } catch {
      /* a UI já voltou ao estado inicial; nada mais a fazer aqui */
    }
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <SpeedContext.Provider value={{ status, progress, result, error, start, cancel }}>
      {children}
    </SpeedContext.Provider>
  );
}

export function useSpeedContext(): SpeedContextValue {
  const ctx = useContext(SpeedContext);
  if (!ctx) throw new Error('useSpeedContext must be used within SpeedProvider');
  return ctx;
}
