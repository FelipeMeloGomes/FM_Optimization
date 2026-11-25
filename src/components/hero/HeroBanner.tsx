import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import BlurText from '../react-bits/BlurText';
import GlareHover from '../react-bits/GlareHover';
import { RouteIcon } from './RouteIcon';

const DEFAULT_SHELL =
  'border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent';

export interface HeroBannerProps {
  /** Ilustração local exibida inteira no lado direito do banner. */
  image: string;
  /** Descrição da ilustração, em português. */
  imageAlt: string;
  badge?: string;
  /** Path da rota: o ícone é o mesmo da sidebar. */
  path?: string;
  title?: string;
  description?: string;
  /** Conteúdo extra (estatísticas, botões, selos) no lugar do texto padrão. */
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Descrição do banner com a mesma revelação palavra por palavra das páginas padrão. */
export function HeroDescription({ text, className }: { text: string; className?: string }) {
  const styles = cn('mt-1 max-w-lg text-sm text-muted-foreground', className);

  // Sem DOM não há animação possível (SSR): mantém o texto legível no markup.
  if (typeof document === 'undefined') return <p className={styles}>{text}</p>;

  return <BlurText text={text} trigger="load" animateBy="words" className={styles} />;
}

/** Banner de topo único: ilustração realista, brilho e texto revelado por palavra. */
export function HeroBanner({
  image,
  imageAlt,
  badge,
  path,
  title,
  description,
  children,
  className,
  contentClassName,
}: HeroBannerProps) {
  return (
    <GlareHover
      width="100%"
      height="12rem"
      borderRadius="0.75rem"
      borderColor="transparent"
      glareOpacity={0.3}
      className={cn(DEFAULT_SHELL, className)}
    >
      <img
        src={image}
        alt={imageAlt}
        className="absolute right-0 top-0 h-full w-3/5 object-contain object-right"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 35%)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-card/95 via-card/60 to-transparent" />
      {children !== undefined ? (
        <div className={cn('relative flex w-full items-center self-stretch', contentClassName)}>
          {children}
        </div>
      ) : (
        <div
          className={cn(
            'relative flex w-full flex-col justify-center self-stretch p-6',
            contentClassName
          )}
        >
          {badge && path && (
            <div className="mb-2 flex items-center gap-2">
              <RouteIcon path={path} />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {badge}
              </span>
            </div>
          )}
          {title && <h2 className="text-lg font-bold text-foreground">{title}</h2>}
          {description && <HeroDescription text={description} />}
        </div>
      )}
    </GlareHover>
  );
}
