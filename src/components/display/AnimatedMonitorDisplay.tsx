import { Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Monitor decorativo do cabeçalho: só animação CSS, sem mexer na tela real. */
export function AnimatedMonitorDisplay({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute right-6 top-1/2 -translate-y-1/2', className)}>
      <div aria-hidden="true" className="animate-monitor-pulse relative size-20">
        <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl" />
        <Monitor className="relative size-16 text-primary drop-shadow-[0_0_12px_var(--color-primary)]" />
        <div className="absolute left-3 right-3 top-8 h-px bg-primary/60 shadow-[0_0_8px_var(--color-primary)]" />
      </div>
    </div>
  );
}
