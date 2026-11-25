import { AlertCircle, ArrowDown, Check, Loader2, Settings, Trophy, Wifi, Zap } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { AnimatedDns } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageSkeleton } from '../components/PageSkeleton';
import { PageRefreshBar } from '../components/RefreshButton';
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

const DNS_PROVIDERS_TO_TEST = DNS_PROVIDERS.filter((provider) => !provider.isDhcp);

export default function DnsPage() {
  return (
    <DnsProvider>
      <DnsPageContent />
    </DnsProvider>
  );
}

function DnsHero() {
  return (
    <HeroBanner visual={<AnimatedDns />}>
      <div className="relative p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <RouteIcon path="/dns" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Rede
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">DNS</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Configure seu DNS para melhor velocidade e privacidade
            </p>
          </div>
        </div>
      </div>
    </HeroBanner>
  );
}

function DnsPageContent() {
  const {
    networkInfo,
    benchmarks,
    benchmarkStatus,
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

  // Ranking por latência, usado para escolher o mais rápido e como base da
  // listagem depois da varredura. Não inclui o pin do ativo.
  const rankedProviders = useMemo(
    () =>
      [...DNS_PROVIDERS].sort((a, b) => {
        if (a.isDhcp) return 1;
        if (b.isDhcp) return -1;
        const la = getLatency(a.primary, a.secondary);
        const lb = getLatency(b.primary, b.secondary);
        if (la === null && lb === null) return 0;
        if (la === null) return 1;
        if (lb === null) return -1;
        return la - lb;
      }),
    [getLatency]
  );

  const sortedProviders = useMemo(() => {
    // Durante a varredura a ordem original importa: o scanner percorre a lista
    // de cima para baixo. A ordenação por latência só faz sentido no fim.
    const base = benchmarkStatus === 'loading' ? [...DNS_PROVIDERS] : rankedProviders;
    // O provedor em uso aparece sempre no topo, inclusive o DHCP quando é o ativo.
    return [...base].sort((a, b) => {
      const ativoA = isActive(a.primary, a.secondary);
      const ativoB = isActive(b.primary, b.secondary);
      if (ativoA && !ativoB) return -1;
      if (!ativoA && ativoB) return 1;
      return 0;
    });
  }, [benchmarkStatus, rankedProviders, isActive]);

  const fastest = useMemo(
    () =>
      rankedProviders.find((p) => !p.isDhcp && getLatency(p.primary, p.secondary) !== null) || null,
    [rankedProviders, getLatency]
  );

  const fastestLatency = fastest ? getLatency(fastest.primary, fastest.secondary) : null;

  // O backend mede os provedores em ordem e publica os dois endereços de cada
  // um. Um DNS com latência null também está medido — não pode travar o scanner.
  const scan = useMemo(() => {
    const medidos = new Set<string>();
    let proximo: string | null = null;
    for (const provider of DNS_PROVIDERS_TO_TEST) {
      if (benchmarks.has(provider.primary) && benchmarks.has(provider.secondary)) {
        medidos.add(provider.name);
      } else if (proximo === null) {
        proximo = provider.name;
      }
    }
    return { medidos, proximo, total: DNS_PROVIDERS_TO_TEST.length };
  }, [benchmarks]);

  if (!networkInfo) {
    return (
      <div className="space-y-6">
        <DnsHero />
        <PageRefreshBar
          onRefresh={runBenchmark}
          refreshing={benchmarkStatus === 'loading'}
          label="Testar Novamente"
          refreshingLabel="Testando…"
        />
        <PageSkeleton
          layout="dns"
          count={DNS_PROVIDERS.length}
          hero="none"
          label="Carregando informações de rede…"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes dns-sweep {
          from { transform: translateX(-110%); }
          to   { transform: translateX(320%); }
        }
        @keyframes dns-result-pop {
          from { opacity: 0; transform: scale(0.86); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes dns-dot {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40%           { opacity: 1; transform: translateY(-2px); }
        }
        .dns-scan-line { animation: dns-sweep 1.25s linear infinite; }
        .dns-result-in { animation: dns-result-pop 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .dns-dot-1 { animation: dns-dot 1.05s ease-in-out infinite; }
        .dns-dot-2 { animation: dns-dot 1.05s ease-in-out 150ms infinite; }
        .dns-dot-3 { animation: dns-dot 1.05s ease-in-out 300ms infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dns-scan-line, .dns-result-in,
          .dns-dot-1, .dns-dot-2, .dns-dot-3 { animation: none; }
        }
      `}</style>

      <DnsHero />

      <PageRefreshBar
        onRefresh={runBenchmark}
        refreshing={benchmarkStatus === 'loading'}
        label="Testar Novamente"
        refreshingLabel="Testando…"
      />

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
        <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite">
          <span className="shrink-0 text-xs font-medium text-primary">Varredura em andamento</span>
          <div
            role="progressbar"
            aria-label="Varredura de DNS"
            aria-valuemin={0}
            aria-valuemax={scan.total}
            aria-valuenow={scan.medidos.size}
            className="flex flex-1 gap-1"
          >
            {DNS_PROVIDERS_TO_TEST.map((provider) => (
              <span
                key={provider.name}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  scan.medidos.has(provider.name)
                    ? 'bg-primary shadow-[0_0_6px_var(--color-primary)]'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {scan.medidos.size}/{scan.total}
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
          const medido = scan.medidos.has(provider.name);
          const testing = benchmarkStatus === 'loading' && scan.proximo === provider.name;
          const aguardando =
            benchmarkStatus === 'loading' && !provider.isDhcp && !medido && !testing;
          const Icon = provider.icon;

          return (
            <Card
              key={provider.name}
              className={cn(
                'transition-[color,background-color,border-color,box-shadow,opacity] duration-200',
                active && 'border-primary/50 shadow-[0_0_15px_var(--color-selection)]',
                isFastest && benchmarkStatus === 'done' && 'border-success/20',
                testing &&
                  'dns-scan-card relative overflow-hidden border-primary/50 shadow-[0_0_18px_var(--color-selection)]',
                aguardando && 'opacity-50',
                medido && 'dns-result-in'
              )}
            >
              {testing && (
                <span
                  aria-hidden="true"
                  className="dns-scan-line pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-primary/25 shadow-[2px_0_12px_var(--color-selection)]"
                />
              )}
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg',
                      active
                        ? 'bg-primary/20'
                        : testing
                          ? 'animate-pulse bg-primary/15 ring-1 ring-primary/40'
                          : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4',
                        active || testing ? 'text-primary' : 'text-muted-foreground'
                      )}
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
                    ) : testing ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Testando
                        <span className="flex gap-0.5" aria-hidden="true">
                          <span className="dns-dot-1 size-1 rounded-full bg-primary" />
                          <span className="dns-dot-2 size-1 rounded-full bg-primary" />
                          <span className="dns-dot-3 size-1 rounded-full bg-primary" />
                        </span>
                      </span>
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
                    ) : medido ? (
                      <span className="text-[11px] text-muted-foreground">Falhou</span>
                    ) : aguardando ? (
                      <span className="text-[11px] text-muted-foreground">Aguardando</span>
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
