import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

export interface AdminNoticeProps {
  message: ReactNode;
  onRelaunch?: () => void;
  relaunching?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  relaunchVariant?: ButtonProps['variant'];
}

/** Aviso inline de que uma ação exige administrador. */
export function AdminNotice({
  message,
  onRelaunch,
  relaunching = false,
  compact = false,
  icon,
  relaunchVariant = 'secondary',
}: AdminNoticeProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5',
        compact ? 'px-4 py-3' : 'p-4'
      )}
    >
      {icon ?? (
        <ShieldAlert
          className={cn(compact ? 'size-4' : 'size-5', 'shrink-0 text-warning')}
          aria-hidden="true"
        />
      )}
      {message}
      {onRelaunch && (
        <Button
          type="button"
          size="sm"
          variant={relaunchVariant}
          className="gap-1.5"
          onClick={onRelaunch}
          disabled={relaunching}
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Reiniciar como admin
        </Button>
      )}
    </div>
  );
}
