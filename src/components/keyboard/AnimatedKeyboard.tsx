import { Keyboard } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Teclado decorativo do cabeçalho: animação CSS pura, sem afetar o teclado real. */
export function AnimatedKeyboard({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute right-6 top-1/2 -translate-y-1/2', className)}>
      <div aria-hidden="true" className="animate-keyboard-glow relative size-20">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
        <Keyboard className="relative size-16 text-primary drop-shadow-[0_0_12px_var(--color-primary)]" />
        <div className="absolute bottom-4 left-5 h-1 w-5 rounded-full bg-primary/70 shadow-[0_0_8px_var(--color-primary)]" />
      </div>
    </div>
  );
}
