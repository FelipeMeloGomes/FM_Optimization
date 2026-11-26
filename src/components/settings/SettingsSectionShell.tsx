import { Children, isValidElement, type ReactNode } from 'react';

export type SettingsTone = 'primary' | 'warning' | 'info' | 'success';

export interface SettingsSectionShellProps {
  title: string;
  tone: SettingsTone;
  variant?: 'rows' | 'panel';
  children: ReactNode;
}

const TONE_CLASS: Record<SettingsTone, string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
};

export function SettingsSectionShell({
  title,
  tone,
  variant = 'rows',
  children,
}: SettingsSectionShellProps) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className={`size-1.5 rounded-full ${TONE_CLASS[tone]}`} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {variant === 'rows' ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {Children.toArray(children).map((child) => (
            <div
              key={isValidElement(child) ? child.key : undefined}
              className="p-4 transition-colors duration-200 hover:bg-muted/30"
            >
              {child}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">{children}</div>
      )}
    </div>
  );
}
