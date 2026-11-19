import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Classes padrão do banner: o mesmo gradiente usado em todas as páginas. */
const DEFAULT_SHELL =
  'relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent';

export interface HeroBannerProps {
  /** Visual animado do canto (AnimatedHero, cursor do Mouse, etc.). */
  visual: ReactNode;
  /** Conteúdo do banner: título, descrição, ações e o que mais a página precisar. */
  children: ReactNode;
  /**
   * Substitui as classes padrão do contêiner (ex.: página CPU usa tons
   * dinâmicos de fabricante). Quando omitido, usa o gradiente padrão.
   */
  className?: string;
  /** Classes extras no conteúdo interno (padrão: `relative p-6`). */
  contentClassName?: string;
}

/**
 * Banner de topo reutilizável. Centraliza o gradiente e o slot do visual
 * animado; o conteúdo textual (selo, título, descrição, botões) pertence a
 * cada página e é passado como children.
 */
export function HeroBanner({ visual, children, className, contentClassName }: HeroBannerProps) {
  return (
    <div className={className ?? DEFAULT_SHELL}>
      {visual}
      <div className={cn('relative p-6', contentClassName)}>{children}</div>
    </div>
  );
}
