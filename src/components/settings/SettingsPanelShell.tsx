import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SettingsPanelShellProps {
  badge: string;
  title?: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Card dos painéis de ajustes do Windows: prévia/controles ficam nos filhos. */
export function SettingsPanelShell({
  badge,
  title = 'Ajustes do Windows',
  note,
  className,
  children,
}: SettingsPanelShellProps) {
  return (
    <section
      className={cn('flex flex-col gap-5 rounded-xl border border-border bg-card p-5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          {badge}
        </span>
      </div>
      {children}
      {note ? <p className="text-[10px] text-muted-foreground">{note}</p> : null}
    </section>
  );
}
