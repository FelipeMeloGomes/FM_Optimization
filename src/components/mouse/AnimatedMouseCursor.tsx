import { MousePointer2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Cursor decorativo do cabeçalho. É apenas animação CSS: nunca move o
 * ponteiro real do usuário.
 */
export function AnimatedMouseCursor({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute right-6 top-1/2 -translate-y-1/2', className)}>
      <div aria-hidden="true" className="animate-mouse-glide relative size-16">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl" />
        <MousePointer2 className="relative size-12 fill-primary/30 text-primary drop-shadow-[0_0_12px_var(--color-primary)]" />
      </div>
    </div>
  );
}
