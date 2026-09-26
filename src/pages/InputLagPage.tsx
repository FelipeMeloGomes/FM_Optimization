import {
  Keyboard,
  Monitor,
  Mouse,
  MousePointerClick,
  Play,
  Square,
  Terminal,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScriptBadge } from '../components/ScriptBadge';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { Badge, Button } from '../components/ui';
import { useScriptPage } from '../hooks/use-script-page';
import { countCuratedScripts, resolveCuratedItems } from '../lib/resolve-curated-scripts';
import { cn } from '../lib/utils';

interface DeviceCard {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  scriptIds: string[];
  whatItOptimizes: string[];
}

const DEVICE_CARDS: DeviceCard[] = [
  {
    id: 'keyboard',
    name: 'Teclado',
    description: 'Reduza a latência de digitação e resposta instantânea de teclas.',
    icon: Keyboard,
    color: 'text-cyan-400',
    dotColor: 'bg-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    scriptIds: ['inputlag-1', 'inputlag-9'],
    whatItOptimizes: [
      'KeyboardDelay reduzido a zero',
      'Resposta instantânea de teclas',
      'Remoção de atraso de menu',
    ],
  },
  {
    id: 'mouse',
    name: 'Mouse',
    description: 'Desative aceleração e obtenha movimento 1:1 preciso.',
    icon: Mouse,
    color: 'text-yellow-400',
    dotColor: 'bg-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    scriptIds: ['inputlag-2', 'inputlag-11'],
    whatItOptimizes: [
      'Aceleração do mouse desativada',
      'Movimento 1:1 precisão absoluta',
      'Tracking consistente em jogos',
    ],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    description: 'Minimize a latência de tolerância do driver de vídeo.',
    icon: Monitor,
    color: 'text-purple-400',
    dotColor: 'bg-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    scriptIds: ['inputlag-3'],
    whatItOptimizes: [
      'Tolerância DXGKrnl reduzida',
      'Menor latência de renderização',
      'Quadros exibidos mais rápido',
    ],
  },
];

interface RegistryItem {
  id: string;
  name: string;
  description: string;
  scriptId: string;
}

const REGISTRY_SCRIPTS: RegistryItem[] = [
  {
    id: 'r1',
    name: 'Aplicar Todas Otimizações',
    description:
      'Aplica todas as otimizações de input lag de uma vez: LargeSystemCache, TCPNoDelay, prioridade e mais.',
    scriptId: 'inputlag-4',
  },
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
  {
    id: 'r7',
    name: 'Taxa de Atualização',
    description: 'Aumenta a taxa de atualização do Windows desabilitando limitação de frame.',
    scriptId: 'inputlag-12',
  },
];

function DeviceSection({
  card,
  scripts,
  activeExecution,
  onCancel,
  onConfirmExecute,
}: {
  card: DeviceCard;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  onConfirmExecute: (script: ScriptEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = card.icon;

  const cardScripts = useMemo(
    () => scripts.filter((s) => card.scriptIds.includes(s.id)),
    [scripts, card.scriptIds]
  );

  const isAnyExecuting = card.scriptIds.some((id) => activeExecution === id);
  const executingScript = cardScripts.find((s) => activeExecution === s.id);

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-300 hover:shadow-lg overflow-hidden',
        card.borderColor,
        isAnyExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-10 items-center justify-center rounded-lg', card.bgColor)}
            >
              <Icon className={cn('size-5', card.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{card.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {cardScripts.length} tweaks
          </Badge>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-foreground mb-2">O que otimiza:</p>
          <ul className="space-y-1">
            {card.whatItOptimizes.map((item, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: static list items, stable order
                key={`opt-${i}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className={cn('size-1 rounded-full', card.dotColor)} />
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
              onClick={() => executingScript && onCancel(executingScript.id)}
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
                if (cardScripts.length === 1) {
                  onConfirmExecute(cardScripts[0]);
                } else {
                  setExpanded(!expanded);
                }
              }}
              className="flex-1 gap-2"
            >
              <Play className="size-3.5" />
              Executar
            </Button>
          )}
        </div>
      </div>

      {expanded && cardScripts.length > 1 && (
        <div className="border-t border-border bg-muted/30 p-4 space-y-2">
          {cardScripts.map((script) => {
            const isScriptExecuting = activeExecution === script.id;
            return (
              <div
                key={script.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-card p-3 transition-all',
                  script.requiresAdmin && 'border-yellow-500/20',
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
                    isScriptExecuting ? onCancel(script.id) : onConfirmExecute(script)
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
                      Executar
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InputLagPage() {
  const {
    state,
    categoryScripts: inputLagScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage('Input Lag');

  // Both section badges count what their section actually renders. The catalog's
  // subcategory buckets cannot be used for this: inputlag-9 and inputlag-11 are
  // filed as "Regedit" in scripts.json but presented under the keyboard and
  // mouse cards, which is why the badges used to read 9/3 against 7/5 rendered.
  const registryItems = useMemo(
    () => resolveCuratedItems(inputLagScripts, REGISTRY_SCRIPTS),
    [inputLagScripts]
  );

  const deviceScriptCount = useMemo(
    () =>
      countCuratedScripts(
        inputLagScripts,
        DEVICE_CARDS.map((c) => c.scriptIds)
      ),
    [inputLagScripts]
  );

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <MousePointerClick className="size-24 text-primary" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Otimização de Input
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Reduza o Input Lag do seu PC</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Cada milissegundo conta. Estas otimizações reduzem a latência do teclado, mouse e
            monitor para uma experiência de jogo mais responsiva e competitiva.
          </p>
        </div>
      </div>

      {/* Device Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">Dispositivos</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {deviceScriptCount} tweaks
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DEVICE_CARDS.map((card) => (
            <DeviceSection
              key={card.id}
              card={card}
              scripts={inputLagScripts}
              activeExecution={activeExecution}
              onCancel={handleCancel}
              onConfirmExecute={handleConfirmExecute}
            />
          ))}
        </div>
      </div>

      {/* Registry Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-yellow-400" />
            <h3 className="text-sm font-semibold text-foreground">Otimizações do Registro</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {registryItems.length} tweaks
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {registryItems.map(({ item, script }) => {
            const isExecuting = activeExecution === script.id;

            return (
              <div
                key={item.id}
                className={cn(
                  'group relative rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg',
                  script.requiresAdmin ? 'border-yellow-500/20' : 'border-border',
                  isExecuting && 'ring-2 ring-primary/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg',
                        script.requiresAdmin ? 'bg-yellow-500/10' : 'bg-muted'
                      )}
                    >
                      <Terminal
                        className={cn(
                          'size-4',
                          script.requiresAdmin ? 'text-yellow-400' : 'text-muted-foreground'
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
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConfirmExecute(script)}
                      className="flex-1 gap-2"
                    >
                      <Play className="size-3.5" />
                      Executar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
  );
}
