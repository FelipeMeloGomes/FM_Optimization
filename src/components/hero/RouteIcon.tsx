import { cn } from '../../lib/utils';
import { getRouteIcon } from '../../routes/route-icons';

export interface RouteIconProps {
  /** Path da rota: o ícone é sempre o mesmo da sidebar. */
  path: string;
  className?: string;
}

/** Ícone pequeno do badge do hero, resolvido pela rota em vez de importado na página. */
export function RouteIcon({ path, className }: RouteIconProps) {
  const Icon = getRouteIcon(path);

  return <Icon className={cn('size-4 text-primary', className)} aria-hidden="true" />;
}
