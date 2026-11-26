import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

export type ErrorPanelVariant = 'full' | 'inline' | 'card';

export interface ErrorPanelProps {
  variant?: ErrorPanelVariant;
  title: string;
  message?: string | null;
  /** Usado quando o texto visível deve ser "título + separador + mensagem". */
  messageSeparator?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryIcon?: ReactNode;
  retryVariant?: ButtonProps['variant'];
  retryClassName?: string;
  icon?: ReactNode;
  className?: string;
  titleClassName?: string;
  messageClassName?: string;
  disabled?: boolean;
}

const variants: Record<ErrorPanelVariant, string> = {
  full: 'flex flex-col items-center justify-center gap-4 py-20 text-center',
  inline:
    'flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3',
  card: 'flex flex-col gap-3 rounded-xl border border-destructive/20 bg-card p-5',
};

/** Estado de erro de IPC/ação — complementa EmptyState (vazio) e ErrorBoundary (render). */
export function ErrorPanel({
  variant = 'full',
  title,
  message,
  messageSeparator = '',
  onRetry,
  retryLabel = 'Tentar novamente',
  retryIcon,
  retryVariant = 'outline',
  retryClassName,
  icon,
  className,
  titleClassName,
  messageClassName,
  disabled = false,
}: ErrorPanelProps) {
  const aligned = variant === 'full' ? 'items-center' : 'items-start';

  return (
    <div role="alert" className={cn('w-full', variants[variant], className)}>
      {icon ?? (
        <AlertTriangle
          className={cn(variant === 'full' ? 'size-8' : 'size-4', 'shrink-0 text-destructive')}
        />
      )}
      <div className={cn('flex flex-col gap-1', aligned)}>
        <p className={cn('text-sm font-medium text-foreground', titleClassName)}>{title}</p>
        {message && (
          <p className={cn('text-xs text-destructive', messageClassName)}>
            {messageSeparator}
            {message}
          </p>
        )}
      </div>
      {onRetry && (
        <Button
          type="button"
          variant={retryVariant}
          size="sm"
          onClick={onRetry}
          disabled={disabled}
          className={cn(aligned, retryClassName)}
        >
          {retryIcon}
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
