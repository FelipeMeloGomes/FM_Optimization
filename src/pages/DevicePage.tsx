import { ChevronDown, Play, Square } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HeroBanner } from '../components/hero/HeroBanner';
import { PageSkeleton } from '../components/PageSkeleton';
import { ScriptBadge } from '../components/ScriptBadge';
import { Button } from '../components/ui';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
import { useScriptPage } from '../hooks/use-script-page';
import type { DevicePageConfig } from '../lib/device-pages';
import { cn } from '../lib/utils';

interface DevicePageProps {
  config: DevicePageConfig;
  /** Conteúdo exibido entre o banner e os tweaks (ex.: ajustes do Windows). */
  beforeContent?: ReactNode;
}

export default function DevicePage({ config, beforeContent }: DevicePageProps) {
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

  const isAnyExecuting = config.scriptIds.some((id) => activeExecution === id);
  const executingScript = scripts.find((script) => activeExecution === script.id);
  const hasMultiple = scripts.length > 1;

  if (state.status === 'loading') {
    return (
      <PageSkeleton
        layout="device"
        settings={Boolean(beforeContent)}
        label="Carregando ajustes do periférico…"
      />
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
      {/* Hero Banner: ilustração real do periférico com brilho e texto animados */}
      <HeroBanner
        badge="Sistema"
        path={config.path}
        title={config.name}
        description={config.heroDescription}
        image={config.heroImage}
        imageAlt={config.heroImageAlt}
      />

      {beforeContent}

      <div>
        <div className="flex items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('size-1.5 rounded-full', config.dotColor)} />
            <h3 className="text-sm font-semibold text-foreground">Dispositivos</h3>
          </div>
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
