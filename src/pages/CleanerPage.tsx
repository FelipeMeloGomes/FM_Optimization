import {
  AlertTriangle,
  Clock,
  Eraser,
  FileIcon,
  Globe,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { CleanerCardSkeleton } from '../components/CleanerCardSkeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { showEnhancedToast } from '../components/EnhancedToast';
import { ScriptBadge } from '../components/ScriptBadge';
import { Button } from '../components/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useSettingsContext } from '../contexts/SettingsContext';
import { formatBytes, useCleanerStats } from '../hooks/use-cleaner-stats';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
import { useScriptPage } from '../hooks/use-script-page';
import { cn } from '../lib/utils';

interface CleanerCard {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  frequency: string;
  whatItCleans: string[];
}

const CLEANER_CARDS: CleanerCard[] = [
  {
    id: 'cleaner-1',
    name: 'Limpeza Rápida',
    description:
      'Remove arquivos temporários, logs do sistema, prefetch e lixeira. Seguro para executar semanalmente.',
    icon: Zap,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    dotColor: 'bg-green-400',
    frequency: 'Semanal',
    whatItCleans: [
      'Arquivos temporários do Windows',
      'Logs do sistema',
      'Prefetch',
      'Lixeira',
      'Cache de miniaturas',
    ],
  },
  {
    id: 'cleaner-2',
    name: 'Limpeza de Atualizações',
    description:
      'Limpa cache do Windows Update, Windows Store e shaders DirectX. Use após instalar atualizadores drivers.',
    icon: RefreshCw,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-400',
    frequency: 'Conforme necessário',
    whatItCleans: [
      'Cache do Windows Update',
      'Cache da Windows Store',
      'Shaders DirectX',
      'Cache de drivers temporários',
    ],
  },
  {
    id: 'cleaner-3',
    name: 'Limpeza de Navegadores',
    description:
      'Apaga cache e dados temporários do Chrome, Edge, Firefox e Brave. Pode exigir login novamente.',
    icon: Globe,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    dotColor: 'bg-purple-400',
    frequency: 'Quando necessário',
    whatItCleans: [
      'Cache do Google Chrome',
      'Cache do Microsoft Edge',
      'Cache do Mozilla Firefox',
      'Cache do Brave Browser',
    ],
  },
  {
    id: 'cleaner-4',
    name: 'Limpeza Total',
    description:
      'Faxina completa: temporários, logs, prefetch, lixeira, navegadores, Windows Update e mais. Execute 1 vez por mês.',
    icon: Trash2,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-400',
    frequency: 'Mensal',
    whatItCleans: [
      'Todas as limpezas anteriores',
      'Cache de componentes do Windows',
      'Limpeza de disco avançada',
      'Limpeza profunda do sistema',
    ],
  },
];

const LARGE_CLEANUP_THRESHOLD_BYTES = 1024 * 1024 * 1024;

function StatsTooltip({
  cleanerId,
  categories,
}: {
  cleanerId: string;
  categories: { label: string; fileCount: number; totalSizeBytes: number }[];
}) {
  if (!categories || categories.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label="Ver detalhes por categoria"
          className="cursor-help underline decoration-dotted underline-offset-2"
        >
          detalhes
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1.5">
          <p className="font-medium text-xs">Detalhes por categoria:</p>
          {categories.map((cat) => (
            <div
              key={`${cleanerId}-${cat.label}`}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="text-muted-foreground">{cat.label}</span>
              <span className="font-medium tabular-nums">
                {cat.fileCount.toLocaleString('pt-BR')} arq. · {formatBytes(cat.totalSizeBytes)}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function formatTimeSince(timestamp: number): string {
  if (timestamp === 0) return '';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin === 1) return 'há 1 min';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH === 1) return 'há 1 hora';
  if (diffH < 24) return `há ${diffH} horas`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'há 1 dia';
  return `há ${diffD} dias`;
}

export default function CleanerPage() {
  const {
    state,
    categoryScripts: cleanerScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage('Cleaner');

  const {
    stats,
    loading: statsLoading,
    isRefreshing,
    lastRefreshed,
    refresh,
    previousStats,
  } = useCleanerStats();

  const { settings } = useSettingsContext();
  const isScriptApplied = useIsScriptApplied();

  const getScriptData = useCallback(
    (scriptId: string) => cleanerScripts.find((s) => s.id === scriptId),
    [cleanerScripts]
  );

  const handleButtonClick = useCallback(
    (card: CleanerCard) => {
      const script = cleanerScripts.find((s) => s.id === card.id);
      if (script) handleConfirmExecute(script);
    },
    [cleanerScripts, handleConfirmExecute]
  );

  const totalStats = useMemo(() => {
    let totalFiles = 0;
    let totalBytes = 0;
    for (const card of CLEANER_CARDS) {
      const s = stats[card.id];
      if (s) {
        totalFiles += s.fileCount;
        totalBytes += s.totalSizeBytes;
      }
    }
    return { totalFiles, totalBytes };
  }, [stats]);

  useEffect(() => {
    const cleanup = window.electronAPI.onScriptEnded((data) => {
      if (data.code === 0) {
        const prev = previousStats.current;
        const freedBytes = Object.keys(stats).reduce((acc, id) => {
          const prevBytes = prev[id]?.totalSizeBytes ?? 0;
          const currBytes = stats[id]?.totalSizeBytes ?? 0;
          return acc + Math.max(0, prevBytes - currBytes);
        }, 0);
        const freedFiles = Object.keys(stats).reduce((acc, id) => {
          const prevCount = prev[id]?.fileCount ?? 0;
          const currCount = stats[id]?.fileCount ?? 0;
          return acc + Math.max(0, prevCount - currCount);
        }, 0);

        refresh();

        if (freedBytes > 0) {
          showEnhancedToast({
            type: 'success',
            title: 'Limpeza concluída',
            description: `Liberado: ${formatBytes(freedBytes)} em ${freedFiles.toLocaleString('pt-BR')} arquivos`,
            duration: 'long',
            sound: settings.soundEnabled,
          });
        } else {
          showEnhancedToast({
            type: 'success',
            title: 'Limpeza concluída',
            description: 'Scripts executados com sucesso',
            duration: 'medium',
            sound: settings.soundEnabled,
          });
        }
      }
    });
    return cleanup;
  }, [refresh, stats, previousStats, settings.soundEnabled]);

  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true" role="status">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CleanerCardSkeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, fixed count
              key={`skeleton-${i}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground"
        role="alert"
      >
        <p className="text-sm">Erro ao carregar scripts de limpeza</p>
        <p className="text-xs text-destructive">{state.error}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
            <Eraser className="size-28 text-primary" aria-hidden="true" />
          </div>
          <div className="relative p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Eraser className="size-4 text-primary" aria-hidden="true" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Limpeza
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Mantenha seu Windows limpo e rápido
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                  Remova arquivos temporários, cache de atualizações e dados de navegadores para
                  liberar espaço e melhorar a performance do sistema.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label="Atualizar estatísticas"
                className="shrink-0 gap-1.5"
              >
                <RefreshCw
                  className={cn('size-3.5', isRefreshing && 'animate-spin')}
                  aria-hidden="true"
                />
                <span className="text-xs">{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
              </Button>
            </div>
            {lastRefreshed > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Atualizado {formatTimeSince(lastRefreshed)}
                {totalStats.totalFiles > 0 && (
                  <span className="ml-2">
                    · {totalStats.totalFiles.toLocaleString('pt-BR')} arquivos ·{' '}
                    {formatBytes(totalStats.totalBytes)} totais para limpar
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div aria-live="polite" className="sr-only">
          {isRefreshing
            ? 'Atualizando estatísticas...'
            : lastRefreshed > 0
              ? 'Estatísticas atualizadas'
              : ''}
        </div>

        {/* Cleaner Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CLEANER_CARDS.map((card) => {
            const script = getScriptData(card.id);
            const isExecuting = activeExecution === card.id;
            const isApplied = !!script && isScriptApplied(script);
            const cardStats = stats[card.id];
            const hasData = cardStats && cardStats.fileCount > 0;
            const hasError = cardStats?.error === true;
            const isLarge = cardStats && cardStats.totalSizeBytes > LARGE_CLEANUP_THRESHOLD_BYTES;

            return (
              <div
                key={card.id}
                className={cn(
                  'group relative rounded-xl border bg-card p-5 transition-all duration-300 hover:shadow-lg',
                  card.borderColor,
                  isExecuting && 'ring-2 ring-primary/50',
                  isLarge && 'border-yellow-500/30'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg',
                        card.bgColor
                      )}
                    >
                      <card.icon className={cn('size-5', card.color)} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{card.name}</h3>
                        {isLarge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">
                                Grande
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Mais de 1 GB de arquivos para limpar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {script && <ScriptBadge script={script} />}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" aria-hidden="true" />
                          {card.frequency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>

                {statsLoading ? (
                  <div className="mt-3 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-full animate-pulse rounded bg-muted" />
                  </div>
                ) : hasError ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                    <span className="text-xs text-muted-foreground">
                      Não foi possível carregar estatísticas
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refresh}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      Retry
                    </Button>
                  </div>
                ) : hasData ? (
                  <div className="mt-3 space-y-2 animate-in fade-in-0 duration-300">
                    <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
                      <FileIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">
                        {cardStats.fileCount.toLocaleString('pt-BR')}{' '}
                        {cardStats.fileCount === 1 ? 'arquivo' : 'arquivos'}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-medium text-foreground">
                        {formatBytes(cardStats.totalSizeBytes)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        <StatsTooltip cleanerId={card.id} categories={cardStats.categories} />
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="text-xs font-medium text-foreground mb-2">O que limpa:</p>
                  <ul className="space-y-1">
                    {card.whatItCleans.map((item, i) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: static list items, stable order
                        key={`clean-${i}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span className={cn('size-1 rounded-full', card.dotColor)} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleButtonClick(card)}
                    disabled={isExecuting}
                    aria-label={
                      isApplied
                        ? `Executar novamente a limpeza ${card.name}`
                        : `Executar limpeza ${card.name}`
                    }
                    className={cn('flex-1 gap-2', isExecuting && 'animate-pulse')}
                  >
                    {isExecuting ? (
                      <>
                        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <card.icon className="size-3.5" aria-hidden="true" />
                        {isApplied ? 'Executar novamente' : 'Executar'}
                      </>
                    )}
                  </Button>
                  {isExecuting && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(card.id)}
                      aria-label="Cancelar execução"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>

                {script?.riskLevel === 'deep' && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/5 p-2 border border-red-500/10">
                    <AlertTriangle
                      className="size-3.5 text-red-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] text-red-400/80 leading-relaxed">
                      Esta limpeza é mais agressiva. Recomendada apenas uma vez por mês para manter
                      o sistema estável.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={!!confirmScript}
          onOpenChange={(open) => {
            if (!open) setConfirmScript(null);
          }}
          script={confirmScript}
          onConfirm={handleConfirm}
          isExecuting={!!confirmScript && activeExecution === confirmScript.id}
        />
      </div>
    </TooltipProvider>
  );
}
