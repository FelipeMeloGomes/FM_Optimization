import {
  AlertTriangle,
  Cpu,
  MessageCircle,
  Monitor,
  Music,
  PackageX,
  Palette,
  Play,
  Shield,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import { type ElementType, useMemo, useRef } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
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
  isScriptExecuting: boolean;
  isScriptApplied: boolean;
  onCancel: (id: string) => void;
  onConfirmExecute: (script: ScriptEntry) => void;
  rowRef?: React.Ref<HTMLDivElement>;
}

function ScriptRow({
  script,
  isScriptExecuting,
  isScriptApplied,
  onCancel,
  onConfirmExecute,
  rowRef,
}: ScriptRowProps) {
  return (
    <div
      ref={rowRef}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-background p-3 transition-all',
        script.requiresAdmin && 'border-warning/20',
        isScriptExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{script.name}</p>
          <ScriptBadge script={script} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{script.description}</p>
      </div>
      <Button
        variant={isScriptExecuting ? 'destructive' : 'secondary'}
        size="sm"
        onClick={() => (isScriptExecuting ? onCancel(script.id) : onConfirmExecute(script))}
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
            {isScriptApplied ? 'Executar novamente' : 'Executar'}
          </>
        )}
      </Button>
    </div>
  );
}

interface VirtualizedSectionCardProps {
  section: AppSection;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  onConfirmExecute: (script: ScriptEntry) => void;
}

export function VirtualizedSectionCard({
  section,
  scripts,
  activeExecution,
  onCancel,
  onConfirmExecute,
}: VirtualizedSectionCardProps) {
  const Icon = SECTION_ICONS[section.icon];
  const isScriptApplied = useIsScriptApplied();

  const sectionScripts = useMemo(
    () => scripts.filter((s) => section.scriptIds.includes(s.id)),
    [scripts, section.scriptIds]
  );

  const isAnyExecuting = section.scriptIds.some((id) => activeExecution === id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    sectionScripts,
    scrollRef,
    SECTION_ROW_HEIGHT
  );

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-300 hover:shadow-lg overflow-hidden',
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

        <div
          ref={scrollRef}
          className="mt-4 relative"
          style={{ height: 'auto', maxHeight: 'none' }}
        >
          {paddingTop > 0 && <div style={{ height: paddingTop }} aria-hidden="true" />}
          <div className="space-y-2" style={{ position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const script = sectionScripts[virtualRow.index];
              const isScriptExecuting = activeExecution === script.id;
              return (
                <ScriptRow
                  key={script.id}
                  script={script}
                  isScriptExecuting={isScriptExecuting}
                  isScriptApplied={isScriptApplied(script)}
                  onCancel={onCancel}
                  onConfirmExecute={onConfirmExecute}
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
