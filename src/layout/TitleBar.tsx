import { Settings } from 'lucide-react';
import { useState } from 'react';
import { AutoCleanModal } from '../components/AutoCleanModal';
import { WindowControls } from '../components/WindowControls';
import { useAutoCleanContext } from '../contexts/AutoCleanContext';
import { cn } from '../lib/utils';

export function TitleBar() {
  const [open, setOpen] = useState(false);
  const { status } = useAutoCleanContext();

  const pending = status?.settings.pending.length ?? 0;
  const enabled = status?.settings.enabled ?? false;

  return (
    <div
      className="flex h-8 shrink-0 items-center justify-end border-b border-border bg-card"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={
            pending > 0
              ? `Configurar limpeza automática (${pending} pendente(s))`
              : 'Configurar limpeza automática'
          }
          title={pending > 0 ? `${pending} limpeza(s) aguardando admin` : 'Limpeza automática'}
          className={cn(
            'relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            enabled && 'text-foreground'
          )}
        >
          <Settings className="size-4" aria-hidden="true" />
          {(pending > 0 || enabled) && (
            <span
              className={cn(
                'absolute right-1.5 top-1.5 size-1.5 rounded-full',
                pending > 0 ? 'bg-amber-400' : 'bg-primary'
              )}
              aria-hidden="true"
            />
          )}
        </button>
        <WindowControls />
      </div>
      <AutoCleanModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
