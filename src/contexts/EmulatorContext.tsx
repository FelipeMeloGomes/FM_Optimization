import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import type { AdbApp } from '../../electron/shared/ipc-types';

interface EmulatorContextValue {
  emulatorAtivo: 'bluestacks-4' | 'bluestacks-5' | null;
  instanciaSelecionada: string | null;
  deviceSerial: string | null;
  listaApps: AdbApp[];
  appsSelecionados: Set<string>;
  carregando: boolean;
  setEmulatorAtivo: (emulator: 'bluestacks-4' | 'bluestacks-5' | null) => void;
  setInstanciaSelecionada: (instance: string | null) => void;
  setDeviceSerial: (serial: string | null) => void;
  setListaApps: (apps: AdbApp[]) => void;
  toggleAppSelection: (packageName: string) => void;
  clearSelection: () => void;
  setAppsSelecionados: (apps: Set<string>) => void;
  setCarregando: (loading: boolean) => void;
}

const EmulatorContext = createContext<EmulatorContextValue | null>(null);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const [emulatorAtivo, setEmulatorAtivo] = useState<'bluestacks-4' | 'bluestacks-5' | null>(null);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<string | null>(null);
  const [deviceSerial, setDeviceSerial] = useState<string | null>(null);
  const [listaApps, setListaApps] = useState<AdbApp[]>([]);
  const [appsSelecionados, setAppsSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);

  const toggleAppSelection = useCallback((packageName: string) => {
    setAppsSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setAppsSelecionados(new Set());
  }, []);

  return (
    <EmulatorContext.Provider
      value={{
        emulatorAtivo,
        instanciaSelecionada,
        deviceSerial,
        listaApps,
        appsSelecionados,
        carregando,
        setEmulatorAtivo,
        setInstanciaSelecionada,
        setDeviceSerial,
        setListaApps,
        toggleAppSelection,
        clearSelection,
        setAppsSelecionados,
        setCarregando,
      }}
    >
      {children}
    </EmulatorContext.Provider>
  );
}

export function useEmulatorContext(): EmulatorContextValue {
  const ctx = useContext(EmulatorContext);
  if (!ctx) throw new Error('useEmulatorContext must be used within EmulatorProvider');
  return ctx;
}
