import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ScriptEnded, ScriptEntry } from '../../electron/shared/ipc-types';

const SCRIPT_TIMEOUT_MS = 30 * 60 * 1000;

interface ScriptExecutionContextValue {
  activeExecution: string | null;
  execute: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  batch: { ids: string[]; index: number } | null;
  executeBatch: (scripts: ScriptEntry[]) => Promise<{ failedIds: string[] }>;
}

const ScriptExecutionContext = createContext<ScriptExecutionContextValue | null>(null);

export function ScriptExecutionProvider({ children }: { children: ReactNode }) {
  const [activeExecution, setActiveExecution] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ ids: string[]; index: number } | null>(null);
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    return window.electronAPI.onScriptEnded((data) => {
      setActiveExecution((prev) => (prev === data.id ? null : prev));
      if (activeRef.current === data.id) activeRef.current = null;
    });
  }, []);

  const runOne = useCallback(async (id: string): Promise<boolean> => {
    activeRef.current = id;
    setActiveExecution(id);
    try {
      await window.electronAPI.executeScript(id);
      return true;
    } catch (e) {
      console.error('Failed to execute script:', e);
      setActiveExecution((prev) => (prev === id ? null : prev));
      if (activeRef.current === id) activeRef.current = null;
      return false;
    }
  }, []);

  const execute = useCallback(
    async (id: string) => {
      await runOne(id);
    },
    [runOne]
  );

  const cancel = useCallback(async (id: string) => {
    try {
      await window.electronAPI.cancelExecution(id);
    } catch (e) {
      console.error('Failed to cancel script:', e);
    }
    setActiveExecution((prev) => (prev === id ? null : prev));
    if (activeRef.current === id) activeRef.current = null;
  }, []);

  const executeBatch = useCallback(
    async (scripts: ScriptEntry[]): Promise<{ failedIds: string[] }> => {
      const failedIds: string[] = [];

      for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index];
        setBatch({ ids: scripts.map((s) => s.id), index: index + 1 });

        let unsubscribe: (() => void) | undefined;
        const endedPromise = new Promise<ScriptEnded>((resolve) => {
          unsubscribe = window.electronAPI.onScriptEnded((data) => {
            if (data.id !== script.id) return;
            resolve(data);
          });
        });

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = script.interactive
          ? new Promise<never>(() => undefined)
          : new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('Script execution timed out')),
                SCRIPT_TIMEOUT_MS
              );
            });

        let failed = false;
        try {
          const spawned = await runOne(script.id);
          if (spawned) {
            const data = await Promise.race([endedPromise, timeoutPromise]);
            failed = data.code !== 0 && !data.cancelled;
          } else {
            failed = true;
          }
        } catch {
          failed = true;
        } finally {
          clearTimeout(timer);
          unsubscribe?.();
        }

        if (failed) failedIds.push(script.id);
      }

      setBatch(null);
      const lastId = scripts[scripts.length - 1]?.id;
      if (lastId) setActiveExecution((prev) => (prev === lastId ? null : prev));
      return { failedIds };
    },
    [runOne]
  );

  return (
    <ScriptExecutionContext.Provider
      value={{ activeExecution, execute, cancel, batch, executeBatch }}
    >
      {children}
    </ScriptExecutionContext.Provider>
  );
}

export function useScriptExecutionContext(): ScriptExecutionContextValue {
  const ctx = useContext(ScriptExecutionContext);
  if (!ctx)
    throw new Error('useScriptExecutionContext must be used within ScriptExecutionProvider');
  return ctx;
}
