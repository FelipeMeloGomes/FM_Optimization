import {
  AlertTriangle,
  MessageCircle,
  Music,
  PackageX,
  Play,
  Shield,
  Square,
  Trash2,
} from 'lucide-react';
import { type ElementType, useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
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
};

export function ScriptSectionCard({
  section,
  scripts,
  activeExecution,
  onCancel,
  onConfirmExecute,
}: {
  section: AppSection;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  onConfirmExecute: (script: ScriptEntry) => void;
}) {
  const Icon = SECTION_ICONS[section.icon];
  const isScriptApplied = useIsScriptApplied();

  const sectionScripts = useMemo(
    () => scripts.filter((s) => section.scriptIds.includes(s.id)),
    [scripts, section.scriptIds]
  );

  const isAnyExecuting = section.scriptIds.some((id) => activeExecution === id);

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
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
            <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-400/80 leading-relaxed">{section.warning}</p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {sectionScripts.map((script) => {
            const isScriptExecuting = activeExecution === script.id;
            return (
              <div
                key={script.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-background p-3 transition-all',
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
                      {isScriptApplied(script) ? 'Executar novamente' : 'Executar'}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
