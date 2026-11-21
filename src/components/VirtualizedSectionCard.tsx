import {
  AlertTriangle,
  Cpu,
  MessageCircle,
  Monitor,
  Music,
  PackageX,
  Palette,
  Shield,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import { type ElementType, useMemo, useRef } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import type { AppSection, SectionIconName } from '../lib/app-sections';
import { cn } from '../lib/utils';
import { ScriptBadge } from './ScriptBadge';
import { Badge, Button } from './ui';

const SECTION_ICONS: Record<SectionIconName, ElementType> = {
  shield: Shield,
  trash: Trash2,
  discord: MessageCircle,
  music: Music,
  package: PackageX,
  monitor: Monitor,
  cpu: Cpu,
  sliders: SlidersHorizontal,
  palette: Palette,
};

const SECTION_ROW_HEIGHT = 69;

interface ScriptRowProps {
  script: ScriptEntry;
  index: number;
  isScriptExecuting: boolean;
  isSelected: boolean;
  onCancel: (id: string) => void;
  onToggle: (id: string) => void;
  disabled: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
}

function ScriptRow({
  script,
  index,
  isScriptExecuting,
  isSelected,
  onCancel,
  onToggle,
  disabled,
  rowRef,
}: ScriptRowProps) {
  return (
    <div
      data-index={index}
      ref={rowRef}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-background p-3 transition-[color,background-color,border-color,box-shadow,opacity]',
        script.requiresAdmin && 'border-warning/20',
        isScriptExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <input
        type="checkbox"
        aria-label={`Selecionar ${script.name}`}
        checked={isSelected}
        disabled={disabled || isScriptExecuting}
        onChange={() => onToggle(script.id)}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p title={script.name} className="truncate text-sm font-medium">
            {script.name}
          </p>
          <ScriptBadge script={script} />
        </div>
        <p title={script.description} className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {script.description}
        </p>
      </div>
      {isScriptExecuting ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onCancel(script.id)}
          className="gap-1.5 shrink-0"
        >
          <Square className="size-3" />
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}

interface VirtualizedSectionCardProps {
  section: AppSection;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}

export function VirtualizedSectionCard({
  section,
  scripts,
  activeExecution,
  onCancel,
  selectedIds,
  onToggle,
  disabled,
}: VirtualizedSectionCardProps) {
  const Icon = SECTION_ICONS[section.icon];

  const sectionScripts = useMemo(
    () => scripts.filter((s) => section.scriptIds.includes(s.id)),
    [scripts, section.scriptIds]
  );

  const isAnyExecuting = section.scriptIds.some((id) => activeExecution === id);

  // null = usa a rolagem da própria página (#main-content). O ref da lista é
  // necessário para descontar a distância até o início dela.
  const listRef = useRef<HTMLDivElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    sectionScripts,
    null,
    SECTION_ROW_HEIGHT,
    listRef
  );

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-[color,background-color,border-color,box-shadow,opacity] duration-300 hover:shadow-lg overflow-hidden',
        section.borderColor,
        isAnyExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-10 items-center justify-center rounded-lg', section.bgColor)}
            >
              <Icon className={cn('size-5', section.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{section.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {sectionScripts.length} tweaks
          </Badge>
        </div>

        {section.warning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/5 border border-warning/10 p-3">
            <AlertTriangle className="size-3.5 text-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-warning leading-relaxed">{section.warning}</p>
          </div>
        )}

        <div ref={listRef} className="mt-4 relative">
          {paddingTop > 0 && <div style={{ height: paddingTop }} aria-hidden="true" />}
          <div className="space-y-2" style={{ position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const script = sectionScripts[virtualRow.index];
              const isScriptExecuting = activeExecution === script.id;
              return (
                <ScriptRow
                  key={script.id}
                  script={script}
                  index={virtualRow.index}
                  isScriptExecuting={isScriptExecuting}
                  isSelected={selectedIds.has(script.id)}
                  onCancel={onCancel}
                  onToggle={onToggle}
                  disabled={disabled}
                  rowRef={measureElement}
                />
              );
            })}
          </div>
          {paddingBottom > 0 && <div style={{ height: paddingBottom }} aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
