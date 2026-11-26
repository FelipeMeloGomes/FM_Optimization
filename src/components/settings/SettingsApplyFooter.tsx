import type { ReactNode } from 'react';
import { Button, ErrorPanel } from '../ui';

export interface SettingsApplyFooterProps {
  isDirty: boolean;
  onApply?: () => void;
  onDiscard?: () => void;
  onRestoreDefault?: () => void;
  onFillDefaults?: () => void;
  busy?: boolean;
  appliedAt?: string | null;
  applied?: boolean;
  appliedLabel?: string;
  appliedInline?: ReactNode;
  applyError?: string | null;
  applyErrorTitle?: string;
  children?: ReactNode;
}

/** Rodapé compartilhado dos painéis: aplicar, descartar, defaults e resultado. */
export function SettingsApplyFooter({
  isDirty,
  onApply,
  onDiscard,
  onRestoreDefault,
  onFillDefaults,
  busy = false,
  appliedAt,
  applied = false,
  appliedLabel = 'Ajustes aplicados',
  appliedInline,
  applyError,
  applyErrorTitle = 'Não foi possível aplicar os ajustes',
  children,
}: SettingsApplyFooterProps) {
  const showApplied = Boolean(appliedAt) || applied;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {onApply && (
          <Button size="sm" disabled={!isDirty || busy} onClick={onApply}>
            Aplicar
          </Button>
        )}
        {onRestoreDefault && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onRestoreDefault}>
            Restaurar padrão
          </Button>
        )}
        {onDiscard && (
          <Button size="sm" variant="ghost" disabled={!isDirty || busy} onClick={onDiscard}>
            Cancelar alterações
          </Button>
        )}
        {onFillDefaults && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onFillDefaults}>
            Preencher com padrões
          </Button>
        )}
        {children}
        {appliedInline ? <span className="text-xs text-primary">{appliedInline}</span> : null}
      </div>
      {showApplied && !appliedInline ? (
        <p className="mt-2 text-xs text-primary">{appliedLabel}</p>
      ) : null}
      {applyError && (
        <ErrorPanel
          variant="inline"
          title={applyErrorTitle}
          message={applyError}
          messageSeparator=": "
          className="mt-2 border-0 bg-transparent p-0"
          titleClassName="text-xs text-destructive"
          messageClassName="text-xs text-destructive"
          icon={false}
        />
      )}
    </>
  );
}
