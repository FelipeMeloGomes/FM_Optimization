import {
  AlertCircle,
  ArrowDown,
  Check,
  Loader2,
  RefreshCw,
  Settings,
  Trophy,
  Wifi,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Badge, Button, Card, CardContent } from '../components/ui';
import { DnsProvider, useDnsContext } from '../contexts/DnsContext';
import { DNS_PROVIDERS } from '../lib/dns-providers';
import { cn } from '../lib/utils';

function getLatencyColor(ms: number): string {
  if (ms < 15) return 'text-success';
  if (ms < 30) return 'text-info';
  if (ms < 50) return 'text-warning';
  return 'text-destructive';
}

function getLatencyBg(ms: number): string {
  if (ms < 15) return 'bg-success/10 border-success/30';
  if (ms < 30) return 'bg-info/10 border-info/30';
  if (ms < 50) return 'bg-warning/10 border-warning/30';
  return 'bg-destructive/10 border-destructive/30';
}

function getLatencyLabel(ms: number): string {
  if (ms < 15) return 'Excelente';
  if (ms < 30) return 'Muito bom';
  if (ms < 50) return 'Bom';
  return 'Regular';
}

export default function DnsPage() {
  return (
    <DnsProvider>
      <DnsPageContent />
    </DnsProvider>
  );
}

function DnsPageContent() {
  const {
    networkInfo,
    benchmarks,
    benchmarkStatus,
    benchmarkProgress,
    applyStatus,
    applyError,
    activeDnsIps,
    runBenchmark,
    applyDns,
  } = useDnsContext();

  const getLatency = useCallback(
    (primary: string, secondary: string): number | null => {
      const r1 = benchmarks.get(primary);
      const r2 = benchmarks.get(secondary);
      const vals = [r1?.latencyMs, r2?.latencyMs].filter(
        (v): v is number => v !== null && v !== undefined
      );
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    },
    [benchmarks]
  );

  const isActive = useCallback(
    (primary: string, secondary: string): boolean => {
      if (!primary) return activeDnsIps.length === 0;
      return activeDnsIps.includes(primary) || activeDnsIps.includes(secondary);
    },
    [activeDnsIps]
  );

  const sortedProviders = useMemo(() => {
    return [...DNS_PROVIDERS].sort((a, b) => {
      if (a.isDhcp) return 1;
      if (b.isDhcp) return -1;
      const la = getLatency(a.primary, a.secondary);
      const lb = getLatency(b.primary, b.secondary);
      if (la === null && lb === null) return 0;
      if (la === null) return 1;
      if (lb === null) return -1;
      return la - lb;
    });
  }, [getLatency]);

  const fastest = useMemo(() => {
    const nonDhcp = sortedProviders.filter((p) => !p.isDhcp);
    return nonDhcp.find((p) => getLatency(p.primary, p.secondary) !== null) || null;
  }, [sortedProviders, getLatency]);

  const fastestLatency = fastest ? getLatency(fastest.primary, fastest.secondary) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">DNS</h2>
          <p className="text-sm text-muted-foreground">
            Configure seu DNS para melhor velocidade e privacidade
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runBenchmark}
          disabled={benchmarkStatus === 'loading'}
          className="gap-1.5"
        >
          {benchmarkStatus === 'loading' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {benchmarkStatus === 'loading' ? 'Testando…' : 'Testar Novamente'}
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Wifi className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Interface de rede</p>
              <p className="text-sm font-medium">
                {networkInfo ? networkInfo.interfaceName : 'Carregando…'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">DNS Atual</p>
              <p className="text-sm font-medium">
                {networkInfo
                  ? networkInfo.currentDns.length > 0
                    ? networkInfo.currentDns.join(', ')
                    : 'DHCP (Automático)'
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {benchmarkStatus === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
        >
          <Loader2 className="size-4 animate-spin text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Testando velocidade dos DNSs…</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width,background-color] duration-500"
                style={{
                  width: `${benchmarkProgress.total > 0 ? (benchmarkProgress.current / benchmarkProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {benchmarkProgress.current}/{benchmarkProgress.total}
          </span>
        </div>
      )}

      {applyError && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {applyError}
        </div>
      )}

      {fastest && fastestLatency !== null && benchmarkStatus === 'done' && (
        <div className="mt-4 relative overflow-hidden rounded-xl border border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent">
          <div className="absolute right-4 top-4">
            <div className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1">
              <Trophy className="size-3 text-success" />
              <span className="text-[11px] font-semibold text-success">Mais rápido</span>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-xl border border-success/30 bg-success/10">
                <fastest.icon className="size-7 text-success" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{fastest.name}</h2>
                <p className="text-sm text-muted-foreground">{fastest.description}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {fastest.primary} / {fastest.secondary}
                </p>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2',
                    getLatencyBg(fastestLatency)
                  )}
                >
                  <Zap className={cn('size-4', getLatencyColor(fastestLatency))} />
                  <span
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      getLatencyColor(fastestLatency)
                    )}
                  >
                    {fastestLatency}
                  </span>
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
                <p className={cn('mt-1 text-xs font-medium', getLatencyColor(fastestLatency))}>
                  {getLatencyLabel(fastestLatency)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="lg"
                disabled={isActive(fastest.primary, fastest.secondary) || applyStatus === 'loading'}
                onClick={() => applyDns(fastest)}
                className="gap-2 px-6 font-semibold shadow-[0_0_20px_var(--color-selection)] hover:shadow-[0_0_30px_var(--color-selection)]"
              >
                {applyStatus === 'loading' || applyStatus === 'elevating' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isActive(fastest.primary, fastest.secondary) ? (
                  <Check className="size-4" />
                ) : (
                  <Zap className="size-4" />
                )}
                {isActive(fastest.primary, fastest.secondary)
                  ? 'DNS Ativo'
                  : applyStatus === 'elevating'
                    ? 'Elevando…'
                    : 'Aplicar DNS Mais Rápido'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {fastest && benchmarkStatus === 'done' && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowDown className="size-3" />
          <span>Todos os DNSs ordenados por velocidade</span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {sortedProviders.map((provider) => {
          const latency = getLatency(provider.primary, provider.secondary);
          const active = isActive(provider.primary, provider.secondary);
          const isFastest = fastest?.name === provider.name && !provider.isDhcp;
          const Icon = provider.icon;

          return (
            <Card
              key={provider.name}
              className={cn(
                'transition-[color,background-color,border-color,box-shadow,opacity] duration-200',
                active && 'border-primary/50 shadow-[0_0_15px_var(--color-selection)]',
                isFastest && benchmarkStatus === 'done' && 'border-success/20'
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg',
                      active ? 'bg-primary/20' : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{provider.name}</h3>
                      {active && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    {!provider.isDhcp && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {provider.primary} / {provider.secondary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {provider.isDhcp ? (
                      <div
                        className="flex items-center gap-1.5 rounded-md border border-muted-foreground/30 bg-muted/40 px-2 py-1"
                        title="Restaura a configuração de DNS automática do provedor"
                      >
                        <Settings className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Padrão
                        </span>
                      </div>
                    ) : latency !== null ? (
                      <div
                        className={cn(
                          'flex items-center gap-1 rounded-md border px-2 py-1',
                          getLatencyBg(latency)
                        )}
                      >
                        <Zap className={cn('size-3', getLatencyColor(latency))} />
                        <span
                          className={cn('text-sm font-bold tabular-nums', getLatencyColor(latency))}
                        >
                          {latency}
                        </span>
                        <span className="text-[11px] text-muted-foreground">ms</span>
                      </div>
                    ) : benchmarkStatus === 'loading' ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}

                    <Button
                      variant={active ? 'secondary' : 'default'}
                      size="sm"
                      disabled={active || applyStatus === 'loading' || applyStatus === 'elevating'}
                      onClick={() => applyDns(provider)}
                      className="gap-1.5 min-w-[70px]"
                    >
                      {applyStatus === 'loading' || applyStatus === 'elevating' ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : active ? (
                        <Check className="size-3" />
                      ) : null}
                      {active ? 'Ativo' : provider.isDhcp ? 'Restaurar' : 'Aplicar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
