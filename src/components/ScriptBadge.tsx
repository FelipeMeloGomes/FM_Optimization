import { RotateCcw, Shield } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { cn } from '../lib/utils';
import { RISK_STYLES } from './ScriptCard';
import { Badge } from './ui';

interface ScriptBadgeProps {
  script: ScriptEntry;
}

/*
 * `font-mono text-[10px]` on these badges is deliberate. Only `.ext` (in the
 * inline copies) is an identifier, so a "mono means identifier" rule does not
 * apply here: these chips are a single visual group of siblings, and mixing
 * typefaces inside the row would read as a kind-difference that isn't there.
 * At 10px Inter also sits below the optical-size axis minimum (14), while
 * JetBrains Mono is built as a grid and stays even at any size.
 *
 * This is the app-wide convention (8 call sites). The inline copies in
 * ScriptCard and ConfirmDialog must keep matching it.
 */
export function ScriptBadge({ script }: ScriptBadgeProps) {
  return (
    <>
      {script.requiresAdmin && (
        <Badge variant="destructive" className="gap-1 font-mono text-[10px] px-1.5 py-0 shrink-0">
          <Shield className="size-3" />
          Admin
        </Badge>
      )}
      {script.requiresRestart && (
        <Badge
          variant="outline"
          className="gap-1 font-mono text-[10px] px-1.5 py-0 shrink-0 border-amber-500/50 text-amber-400"
        >
          <RotateCcw className="size-3" />
          Reiniciar
        </Badge>
      )}
      {script.riskLevel && (
        <Badge
          variant="outline"
          className={cn(
            'gap-1 font-mono text-[10px] px-1.5 py-0 shrink-0',
            RISK_STYLES[script.riskLevel].className
          )}
        >
          {RISK_STYLES[script.riskLevel].label}
        </Badge>
      )}
    </>
  );
}
