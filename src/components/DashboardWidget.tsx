import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent, Progress } from './ui';

interface DashboardWidgetProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  progress?: number;
  status?: 'default' | 'good' | 'warning' | 'danger';
  className?: string;
}

const STATUS_STYLES = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    border: 'hover:border-primary/30',
  },
  good: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    border: 'hover:border-success/30',
  },
  warning: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    border: 'hover:border-warning/30',
  },
  danger: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    border: 'hover:border-destructive/30',
  },
};

export const DashboardWidget = memo(function DashboardWidget({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  status = 'default',
  className,
}: DashboardWidgetProps) {
  const styles = STATUS_STYLES[status];

  return (
    <Card
      className={cn(
        'transition-all duration-300',
        styles.border,
        'hover:shadow-[0_0_20px_var(--color-selection)]',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn('flex size-9 items-center justify-center rounded-lg', styles.iconBg)}>
            <Icon className={cn('size-4', styles.iconColor)} aria-hidden="true" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="mt-3">
          <div className="text-base font-semibold text-foreground tabular-nums leading-tight">
            {value || '—'}
          </div>
          {detail && (
            <div title={detail} className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {detail}
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Uso</span>
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {progress}%
              </span>
            </div>
            <Progress
              value={progress}
              className={cn(
                'h-1.5',
                progress > 90 && '[&>div]:bg-destructive',
                progress > 70 && progress <= 90 && '[&>div]:bg-warning',
                progress <= 70 && '[&>div]:bg-success'
              )}
              aria-label={`${label}: ${value}`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
