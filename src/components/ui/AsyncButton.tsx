import { Loader2 } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

export interface AsyncButtonProps extends Omit<ButtonProps, 'children'> {
  loading: boolean;
  loadingLabel: string;
  busyIcon?: ReactNode;
  children: ReactNode;
}

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      loading,
      loadingLabel,
      busyIcon = <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />,
      children,
      disabled,
      ...props
    },
    ref
  ) => (
    <Button {...props} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? (
        <>
          {busyIcon}
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
);
AsyncButton.displayName = 'AsyncButton';
