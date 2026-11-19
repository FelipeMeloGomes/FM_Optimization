import { ChevronDown, Play, Square, Zap } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScriptBadge } from '../components/ScriptBadge';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { Badge, Button } from '../components/ui';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
import { useScriptPage } from '../hooks/use-script-page';
import type { DevicePageConfig } from '../lib/device-pages';
import { countCuratedScripts } from '../lib/resolve-curated-scripts';
import { cn } from '../lib/utils';

interface DevicePageProps {
  config: DevicePageConfig;
  /** Substitui o ícone grande do banner (ex.: cursor animado da página Mouse). */
  heroVisual?: ReactNode;
  /** Conteúdo exibido entre o banner e os tweaks (ex.: ajustes do Windows). */
  beforeContent?: ReactNode;
}

export default function DevicePage({ config, heroVisual, beforeContent }: DevicePageProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    state,
    categoryScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage(config.category);
  const isScriptApplied = useIsScriptApplied();
  const Icon = config.icon;

  const scripts = useMemo(
    () => categoryScripts.filter((script) => config.scriptIds.includes(script.id)),
    [categoryScripts, config.scriptIds]
  );

  const scriptCount = useMemo(
    () => countCuratedScripts(categoryScripts, [config.scriptIds]),
    [categoryScripts, config.scriptIds]
  );

  const isAnyExecuting = config.scriptIds.some((id) => activeExecution === id);
  const executingScript = scripts.find((script) => activeExecution === script.id);
  const hasMultiple = scripts.length > 1;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, fixed count
            <ScriptCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar tweaks</p>
        <p className="text-xs text-destructive">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        {heroVisual ?? (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
            <Icon className="size-24 text-primary" />
          </div>
        )}
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Sistema
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">{config.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">{config.heroDescription}</p>
        </div>
      </div>

      {beforeContent}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('size-1.5 rounded-full', config.dotColor)} />
            <h3 className="text-sm font-semibold text-foreground">Dispositivos</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {scriptCount} tweaks
          </Badge>
        </div>

        <div
          className={cn(
            'rounded-xl border bg-card transition-[color,background-color,border-color,box-shadow,opacity] duration-300 hover:shadow-lg overflow-hidden',
            config.borderColor,
            isAnyExecuting && 'ring-2 ring-primary/50'
          )}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg',
                    config.bgColor
                  )}
                >
                  <Icon className={cn('size-5', config.color)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{config.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {scripts.length} tweaks
              </Badge>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-foreground mb-2">O que otimiza:</p>
              <ul className="space-y-1">
                {config.whatItOptimizes.map((item, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list items, stable order
                    key={`opt-${i}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className={cn('size-1 rounded-full', config.dotColor)} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex gap-2">
              {isAnyExecuting ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => executingScript && handleCancel(executingScript.id)}
                  className="flex-1 gap-2"
                >
                  <Square className="size-3.5" />
                  Cancelar
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (hasMultiple) {
                      setExpanded(!expanded);
                    } else {
                      handleConfirmExecute(scripts[0]);
                    }
                  }}
                  className="flex-1 gap-2"
                >
                  {hasMultiple ? (
                    <>
                      <ChevronDown
                        className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
                      />
                      {expanded ? 'Ocultar tweaks' : 'Ver tweaks'}
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      {scripts.some((script) => isScriptApplied(script))
                        ? 'Executar novamente'
                        : 'Executar'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {expanded && scripts.length > 1 && (
            <div className="border-t border-border bg-muted/30 p-4 space-y-2">
              {scripts.map((script) => {
                const isScriptExecuting = activeExecution === script.id;
                return (
                  <div
                    key={script.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-card p-3 transition-[color,background-color,border-color,box-shadow,opacity]',
                      script.requiresAdmin && 'border-warning/20',
                      isScriptExecuting && 'ring-2 ring-primary/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{script.name}</p>
                        <ScriptBadge script={script} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {script.description}
                      </p>
                    </div>
                    <Button
                      variant={isScriptExecuting ? 'destructive' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        isScriptExecuting ? handleCancel(script.id) : handleConfirmExecute(script)
                      }
                      className="gap-1.5 shrink-0"
                    >
                      {isScriptExecuting ? (
                        <>
                          <Square className="size-3" />
                          Cancelar
                        </>
                      ) : (
                        <>
                          <Play className="size-3" />
                          {isScriptApplied(script) ? 'Executar novamente' : 'Executar'}
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
  );
}
