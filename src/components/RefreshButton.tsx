import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui';

export interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing?: boolean;
  label?: string;
  refreshingLabel?: string;
  ariaLabel?: string;
  /** Botões de ícone só (ex.: lista de apps) ainda recebem um nome acessível. */
  iconOnly?: boolean;
}

/** Único botão de atualização do app: sempre outline opaco, ícone RefreshCw e giro na carga. */
export function RefreshButton({
  onRefresh,
  refreshing = false,
  label = 'Atualizar',
  refreshingLabel = 'Atualizando…',
  ariaLabel,
  iconOnly = false,
}: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={ariaLabel ?? (refreshing ? refreshingLabel : label)}
      className="shrink-0 gap-1.5"
    >
      <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
      {!iconOnly && <span className="text-xs">{refreshing ? refreshingLabel : label}</span>}
    </Button>
  );
}

export interface PageRefreshBarProps extends RefreshButtonProps {
  /** Texto de "atualizado há…" exibido à esquerda da faixa. */
  status?: ReactNode;
  /** Outras ações da página (ex.: exportar relatório) alinhadas junto do botão. */
  children?: ReactNode;
}

/**
 * Faixa abaixo do HeroBanner. Fica fora do banner de propósito: o visual
 * animado é absoluto no canto direito e um botão dentro dele acaba tapando a
 * animação.
 */
export function PageRefreshBar({ status, children, ...refresh }: PageRefreshBarProps) {
  return (
    <fieldset
      aria-label="Atualizar dados"
      // `mx-0` zera apenas as margens laterais padrão do fieldset: `m-0` também
      // anularia o margin-block-end do `space-y-6` e colaria o botão no card abaixo.
      className="mx-0 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-0 p-0"
    >
      {status && <p className="mr-auto text-[10px] text-muted-foreground">{status}</p>}
      {children}
      <RefreshButton {...refresh} />
    </fieldset>
  );
}
