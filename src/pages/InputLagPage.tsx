import { Square, Terminal, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedInputLag } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptBadge } from '../components/ScriptBadge';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { Badge, Button } from '../components/ui';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { resolveCuratedItems } from '../lib/resolve-curated-scripts';
import { cn } from '../lib/utils';

interface RegistryItem {
  id: string;
  name: string;
  description: string;
  scriptId: string;
}

const REGISTRY_SCRIPTS: RegistryItem[] = [
  {
    id: 'r2',
    name: 'Reduzir Input Lag USB',
    description:
      'Desativa a suspensão seletiva USB para evitar que dispositivos entrem em modo de economia.',
    scriptId: 'inputlag-5',
  },
  {
    id: 'r3',
    name: 'TCPNoDelay',
    description: 'Ativa TCPNoDelay para desabilitar o algoritmo Nagle, reduzindo latência de rede.',
    scriptId: 'inputlag-6',
  },
  {
    id: 'r4',
    name: 'Prioridade de Foreground',
    description: 'Ajusta Win32PrioritySeparation para priorizar aplicações em primeiro plano.',
    scriptId: 'inputlag-7',
  },
  {
    id: 'r5',
    name: 'Desativar LargeSystemCache',
    description:
      'Reduz o uso de memória pelo cache do sistema, liberando recursos para applications.',
    scriptId: 'inputlag-8',
  },
  {
    id: 'r6',
    name: 'Atraso no Menu',
    description: 'Remove o atraso de exibição de menus definindo MenuShowDelay como 0.',
    scriptId: 'inputlag-10',
  },
];

export default function InputLagPage() {
  const {
    state,
    categoryScripts: inputLagScripts,
    activeExecution,
    handleCancel,
    handleApply,
    batch,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    failedScripts,
    clearFailures,
  } = useScriptPage('Input Lag');

  // O selo conta os itens curados que a página realmente renderiza, não o
  // balde de subcategoria do catálogo.
  const registryItems = useMemo(
    () => resolveCuratedItems(inputLagScripts, REGISTRY_SCRIPTS),
    [inputLagScripts]
  );

  const selectableScripts = useMemo(
    () => registryItems.map(({ script }) => script),
    [registryItems]
  );

  const { selectedIds, selectedScripts, toggle, isSelected, selectAll, clear } =
    useScriptSelection(selectableScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedInputLag />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Otimização de Input
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Reduza o Input Lag do seu PC</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Ajustes de registro e do sistema que reduzem a latência de resposta, USB e rede para uma
            experiência de jogo mais competitiva.
          </p>
        </div>
      </HeroBanner>

      {/* Registry Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-warning" />
            <h3 className="text-sm font-semibold text-foreground">Otimizações do Registro</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {registryItems.length} tweaks
          </Badge>
        </div>

        {/* Seleção múltipla */}
        <ScriptSelectionToolbar
          availableIds={selectableScripts.map((s) => s.id)}
          selectedIds={selectedIds}
          selectedScripts={selectedScripts}
          onSelectAll={selectAll}
          onClear={clear}
          onApply={handleApply}
          applying={disabled}
          progress={batch ? { index: batch.index, total: batch.ids.length } : null}
          failedScripts={failedScripts}
          onDismissFailures={clearFailures}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {registryItems.map(({ item, script }) => {
            const isExecuting = activeExecution === script.id;
            const isSel = isSelected(script.id);

            return (
              <div
                key={item.id}
                className={cn(
                  'group relative rounded-xl border bg-card p-4 transition-[color,background-color,border-color,box-shadow,opacity] duration-300 hover:shadow-lg',
                  script.requiresAdmin ? 'border-warning/20' : 'border-border',
                  (isSel || isExecuting) && 'ring-2 ring-primary/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg',
                        script.requiresAdmin ? 'bg-warning/10' : 'bg-muted'
                      )}
                    >
                      <Terminal
                        className={cn(
                          'size-4',
                          script.requiresAdmin ? 'text-warning' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </h4>
                        <ScriptBadge script={script} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${item.name}`}
                    checked={isSel}
                    disabled={disabled || isExecuting}
                    onChange={() => toggle(script.id)}
                    className="shrink-0 mt-0.5"
                  />
                  {isExecuting ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(script.id)}
                      className="flex-1 gap-2"
                    >
                      <Square className="size-3.5" />
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmação do lote */}
      <ConfirmBulkScriptDialog
        open={confirmBulkScripts.length > 0}
        onOpenChange={(open) => {
          if (!open) setConfirmBulkScripts([]);
        }}
        scripts={confirmBulkScripts}
        onConfirm={handleConfirmBulk}
      />
    </div>
  );
}
