import { Square, Terminal } from 'lucide-react';
import { useRef } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import { cn } from '../lib/utils';
import { ScriptBadge } from './ScriptBadge';
import { Button } from './ui';
import { VirtualSpacer } from './VirtualSpacer';

const ROW_HEIGHT = 69;

export interface VirtualizedScriptListProps {
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
  labels?: Record<string, { name: string; description: string }>;
}

/**
 * Lista única de tweaks no padrão da Limpeza: uma linha por script, com
 * checkbox, rótulo clicável e botão Cancelar só no script em execução. A rolagem
 * é da página (`scrollRef = null`); `data-index` fica no elemento medido.
 */
export function VirtualizedScriptList({
  scripts,
  activeExecution,
  onCancel,
  selectedIds,
  onToggle,
  disabled,
  labels,
}: VirtualizedScriptListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    scripts,
    null,
    ROW_HEIGHT,
    listRef
  );

  return (
    <div
      data-testid="tweaks-list"
      className="relative overflow-hidden rounded-xl border border-border bg-card"
    >
      {paddingTop > 0 ? <VirtualSpacer height={paddingTop} testId="virtual-spacer-top" /> : null}

      <ul ref={listRef} className="divide-y divide-border">
        {virtualItems.map((virtualRow) => {
          const script = scripts[virtualRow.index];
          const checkboxId = `tweak-item-${script.id}`;
          const isExecuting = activeExecution === script.id;
          const isSelected = selectedIds.has(script.id);
          const name = labels?.[script.id]?.name ?? script.name;
          const description = labels?.[script.id]?.description ?? script.description;

          return (
            <li
              key={script.id}
              data-index={virtualRow.index}
              ref={measureElement}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                (isSelected || isExecuting) && 'bg-primary/5'
              )}
            >
              <input
                id={checkboxId}
                type="checkbox"
                aria-label={`Selecionar ${name}`}
                checked={isSelected}
                disabled={disabled || isExecuting}
                onChange={() => onToggle(script.id)}
                className="size-4 shrink-0 accent-primary"
              />

              <label
                htmlFor={checkboxId}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    script.requiresAdmin ? 'bg-warning/10' : 'bg-primary/10'
                  )}
                >
                  <Terminal
                    className={cn('size-4', script.requiresAdmin ? 'text-warning' : 'text-primary')}
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span title={name} className="truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <ScriptBadge script={script} />
                  </span>
                  <span
                    title={description}
                    className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground"
                  >
                    {description}
                  </span>
                </span>
              </label>

              {isExecuting ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onCancel(script.id)}
                  className="shrink-0 gap-1.5"
                >
                  <Square className="size-3" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {paddingBottom > 0 ? (
        <VirtualSpacer height={paddingBottom} testId="virtual-spacer-bottom" />
      ) : null}
    </div>
  );
}
