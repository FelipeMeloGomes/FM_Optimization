import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { BenchmarkResult, NetworkInfo } from '../../electron/shared/ipc-types';
import { DNS_PROVIDERS, type DnsProvider as DnsProviderType } from '../lib/dns-providers';

interface DnsContextValue {
  networkInfo: NetworkInfo | null;
  benchmarks: Map<string, BenchmarkResult>;
  benchmarkStatus: 'idle' | 'loading' | 'done';
  benchmarkProgress: { current: number; total: number };
  applyStatus: 'idle' | 'loading' | 'error' | 'elevating';
  applyError: string | null;
  activeDnsIps: string[];
  runBenchmark: () => Promise<void>;
  applyDns: (provider: DnsProviderType) => Promise<void>;
}

const DnsContext = createContext<DnsContextValue | null>(null);

export function DnsProvider({ children }: { children: ReactNode }) {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [benchmarks, setBenchmarks] = useState<Map<string, BenchmarkResult>>(new Map());
  const [benchmarkStatus, setBenchmarkStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [benchmarkProgress, setBenchmarkProgress] = useState({ current: 0, total: 0 });
  const [applyStatus, setApplyStatus] = useState<'idle' | 'loading' | 'error' | 'elevating'>(
    'idle'
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const [activeDnsIps, setActiveDnsIps] = useState<string[]>([]);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const info = await window.electronAPI.getNetworkInfo();
      setNetworkInfo(info);
      setActiveDnsIps(info.currentDns);
      return info;
    } catch {
      return null;
    }
  }, []);

  const runBenchmark = useCallback(async () => {
    setBenchmarkStatus('loading');
    setBenchmarks(new Map());
    const providers = DNS_PROVIDERS.filter((p) => !p.isDhcp).map((p) => ({
      primary: p.primary,
      secondary: p.secondary,
    }));
    setBenchmarkProgress({ current: 0, total: providers.length });

    const cleanupProgress = window.electronAPI.onBenchmarkProgress((progress) => {
      setBenchmarkProgress(progress);
    });
    const cleanupResult = window.electronAPI.onBenchmarkResult((result) => {
      setBenchmarks((prev) => {
        const next = new Map(prev);
        next.set(result.address, result);
        return next;
      });
    });

    try {
      await window.electronAPI.benchmarkDns(providers);
      setBenchmarkStatus('done');
    } catch {
      setBenchmarkStatus('done');
    } finally {
      cleanupProgress();
      cleanupResult();
    }
  }, []);

  const applyDns = useCallback(
    async (provider: DnsProviderType) => {
      if (!networkInfo) return;
      setApplyStatus('loading');
      setApplyError(null);
      try {
        const addresses = provider.isDhcp ? [] : [provider.primary, provider.secondary];
        await window.electronAPI.applyDns(networkInfo.interfaceIndex, addresses);
        setActiveDnsIps(addresses);
        setApplyStatus('idle');
      } catch (e: unknown) {
        const errorMsg = typeof e === 'string' ? e : (e as Error).message;
        // Se erro for de admin, eleva e reaplica
        if (errorMsg.includes('administrador') || errorMsg.includes('admin')) {
          setApplyStatus('elevating');
          try {
            const addresses = provider.isDhcp ? [] : [provider.primary, provider.secondary];
            const result = await window.electronAPI.elevateApp(
              undefined,
              networkInfo.interfaceIndex,
              addresses
            );
            if (!result.launched) {
              // UAC cancelado (ou falha): o app atual continua vivo e o DNS
              // segue como estava.
              setApplyStatus('error');
              setApplyError(
                result.cancelled
                  ? 'Elevação cancelada. O DNS não foi alterado.'
                  : `Falha ao elevar privilégios: ${result.error ?? 'erro desconhecido'}`
              );
              setTimeout(() => setApplyStatus('idle'), 4000);
            }
            // A instância elevada aplica o DNS e substitui esta (o renderer
            // desta janela encerra junto).
          } catch {
            // Se falhar ao elevar, mostra erro
            setApplyStatus('error');
            setApplyError(`Erro ao elevar privilégios: ${errorMsg}`);
            setTimeout(() => setApplyStatus('idle'), 3000);
          }
        } else {
          setApplyStatus('error');
          setApplyError(errorMsg);
          setTimeout(() => setApplyStatus('idle'), 3000);
        }
      }
    },
    [networkInfo]
  );

  useEffect(() => {
    let cleanupProgress: (() => void) | undefined;
    let cleanupResult: (() => void) | undefined;
    fetchNetworkInfo().then((info) => {
      if (info) {
        const providers = DNS_PROVIDERS.filter((p) => !p.isDhcp).map((p) => ({
          primary: p.primary,
          secondary: p.secondary,
        }));
        setBenchmarkStatus('loading');
        setBenchmarkProgress({ current: 0, total: providers.length });

        cleanupProgress = window.electronAPI.onBenchmarkProgress((progress) => {
          setBenchmarkProgress(progress);
        });
        cleanupResult = window.electronAPI.onBenchmarkResult((result) => {
          setBenchmarks((prev) => {
            const next = new Map(prev);
            next.set(result.address, result);
            return next;
          });
        });

        window.electronAPI
          .benchmarkDns(providers)
          .then(() => {
            setBenchmarkStatus('done');
          })
          .catch(() => setBenchmarkStatus('done'));
      }
    });
    return () => {
      cleanupProgress?.();
      cleanupResult?.();
    };
  }, [fetchNetworkInfo]);

  return (
    <DnsContext.Provider
      value={{
        networkInfo,
        benchmarks,
        benchmarkStatus,
        benchmarkProgress,
        applyStatus,
        applyError,
        activeDnsIps,
        runBenchmark,
        applyDns,
      }}
    >
      {children}
    </DnsContext.Provider>
  );
}

export function useDnsContext(): DnsContextValue {
  const ctx = useContext(DnsContext);
  if (!ctx) throw new Error('useDnsContext must be used within DnsProvider');
  return ctx;
}
