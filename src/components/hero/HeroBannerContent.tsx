import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { HeroDescription } from './HeroBanner';
import { RouteIcon } from './RouteIcon';

export interface HeroBannerContentProps {
  badge?: string;
  path?: string;
  title: string;
  description: string;
  size?: 'md' | 'lg';
  trailing?: ReactNode;
  titleTrailing?: ReactNode;
  footer?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

const titleSizes = {
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

/** Corpo textual do HeroBanner, com opções para banners que saem do padrão. */
export function HeroBannerContent({
  badge,
  path,
  title,
  description,
  size = 'md',
  trailing,
  titleTrailing,
  footer,
  className,
  titleClassName,
  descriptionClassName,
}: HeroBannerContentProps) {
  return (
    <div className={cn('relative flex w-full flex-col justify-center self-stretch p-6', className)}>
      <div className={cn('flex items-start', trailing && 'justify-between gap-4')}>
        <div className="min-w-0">
          {badge && path && (
            <div className="mb-2 flex items-center gap-2">
              <RouteIcon path={path} />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {badge}
              </span>
            </div>
          )}
          <div className={cn('flex items-center', titleTrailing && 'gap-3')}>
            <h2 className={cn('font-bold text-foreground', titleSizes[size], titleClassName)}>
              {title}
            </h2>
            {titleTrailing}
          </div>
          <HeroDescription text={description} className={descriptionClassName} />
          {footer}
        </div>
        {trailing}
      </div>
    </div>
  );
}
