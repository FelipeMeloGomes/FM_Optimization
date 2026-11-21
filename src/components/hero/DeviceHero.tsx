import type { LucideIcon } from 'lucide-react';
import BlurText from '../react-bits/BlurText';
import GlareHover from '../react-bits/GlareHover';

export interface DeviceHeroProps {
  badge: string;
  icon: LucideIcon;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

/** Hero com foto real e brilho, compartilhado por Mouse, Monitor, Teclado e Armazenamento. */
export function DeviceHero({
  badge,
  icon: Icon,
  title,
  description,
  image,
  imageAlt,
}: DeviceHeroProps) {
  return (
    <GlareHover
      width="100%"
      height="9rem"
      borderRadius="0.75rem"
      borderColor="transparent"
      glareOpacity={0.3}
      className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
    >
      <img
        src={image}
        alt={imageAlt}
        className="absolute right-0 top-0 h-full w-3/5 object-cover"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 35%)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-card/95 via-card/60 to-transparent" />
      <div className="relative flex w-full flex-col justify-center self-stretch p-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            {badge}
          </span>
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <BlurText
          text={description}
          trigger="load"
          animateBy="words"
          className="mt-1 max-w-lg text-sm text-muted-foreground"
        />
      </div>
    </GlareHover>
  );
}
