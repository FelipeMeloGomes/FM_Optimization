import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { getRouteIcon } from '../../routes/route-icons';

export type HeroAnimation =
  | 'float'
  | 'pulse'
  | 'spin'
  | 'drift'
  | 'scan'
  | 'tilt'
  | 'drop'
  | 'storage'
  | 'repair';

const ANIMATION_CLASS: Record<HeroAnimation, string> = {
  float: 'animate-hero-float',
  pulse: 'animate-hero-pulse',
  spin: 'animate-hero-spin',
  drift: 'animate-hero-drift',
  scan: 'animate-hero-scan',
  tilt: 'animate-hero-tilt',
  drop: 'animate-hero-drop',
  storage: 'animate-hero-storage',
  repair: 'animate-hero-repair',
};

function accentFor(animation: HeroAnimation): ReactNode {
  switch (animation) {
    case 'float':
      return (
        <div className="absolute -bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary/30 blur-sm" />
      );
    case 'pulse':
      return <div className="absolute inset-2 rounded-full border border-primary/20" />;
    case 'spin':
      return (
        <div className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
      );
    case 'drift':
      return <div className="absolute -left-3 top-1/2 h-px w-6 bg-primary/40" />;
    case 'scan':
      return (
        <div className="animate-hero-scanline absolute left-2 right-2 top-1/2 h-px bg-primary/70 shadow-[0_0_8px_var(--color-primary)]" />
      );
    case 'tilt':
      return (
        <div className="absolute bottom-1 right-1 size-1.5 rounded-full bg-primary/70 shadow-[0_0_8px_var(--color-primary)]" />
      );
    case 'drop':
      return (
        <div className="absolute -bottom-1 left-1/2 h-2 w-px -translate-x-1/2 bg-primary/70 shadow-[0_0_8px_var(--color-primary)]" />
      );
    case 'storage':
      return (
        <div className="absolute bottom-1 left-2 right-2 h-px bg-primary/50 shadow-[0_0_8px_var(--color-primary)]" />
      );
    case 'repair':
      return (
        <div className="absolute inset-2 rounded-full border border-primary/30 animate-hero-pulse" />
      );
  }
}

export interface AnimatedHeroProps {
  /** Path da rota: o ícone vem de `ROUTE_ICONS`, igual ao da sidebar. */
  path: string;
  animation: HeroAnimation;
  /** Cor do ícone (ex.: o tom dinâmico da página CPU). */
  iconClassName?: string;
  className?: string;
}

/**
 * Visual decorativo do banner. Animação CSS pura: não afeta nenhum serviço,
 * configuração ou dado do sistema — é o mesmo padrão do cursor/teclado/monitor.
 */
export function AnimatedHero({ path, animation, iconClassName, className }: AnimatedHeroProps) {
  const Icon = getRouteIcon(path);

  return (
    <div className={cn('pointer-events-none absolute right-8 top-1/2 -translate-y-1/2', className)}>
      <div
        aria-hidden="true"
        data-hero-animation={animation}
        className={cn('relative size-20', ANIMATION_CLASS[animation])}
      >
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
        <Icon
          className={cn(
            'relative size-16 text-primary drop-shadow-[0_0_12px_var(--color-primary)]',
            iconClassName
          )}
        />
        {accentFor(animation)}
      </div>
    </div>
  );
}

/* Cada página escolhe só a animação; o ícone é sempre o da sua rota. */
export function AnimatedDashboard(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/" animation="scan" {...props} />;
}

export function AnimatedCpu(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/cpu" animation="pulse" {...props} />;
}

export function AnimatedCleaner(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/cleaner" animation="scan" {...props} />;
}

export function AnimatedDebloat(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/debloat" animation="drop" {...props} />;
}

export function AnimatedDns(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/dns" animation="drift" {...props} />;
}

export function AnimatedNetwork(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/rede" animation="pulse" {...props} />;
}

export function AnimatedSpeedTest(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/velocidade" animation="scan" {...props} />;
}

export function AnimatedEmuladores(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/emuladores" animation="float" {...props} />;
}

export function AnimatedEssentials(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/essenciais" animation="drop" {...props} />;
}

export function AnimatedHistory(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/history" animation="spin" {...props} />;
}

export function AnimatedInputLag(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/input-lag" animation="drift" {...props} />;
}

export function AnimatedPersonalization(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/personalizacao" animation="float" {...props} />;
}

export function AnimatedPrivacySecurity(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/privacidade-seguranca" animation="pulse" {...props} />;
}

export function AnimatedStorage(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/armazenamento" animation="storage" {...props} />;
}

export function AnimatedRepair(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/reparo-do-sistema" animation="repair" {...props} />;
}

export function AnimatedRestorePoints(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/restore-points" animation="tilt" {...props} />;
}

export function AnimatedSettings(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/settings" animation="spin" {...props} />;
}

export function AnimatedStartup(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/inicializacao" animation="float" {...props} />;
}

export function AnimatedUtilities(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/utilities" animation="tilt" {...props} />;
}

export function AnimatedMeuPc(props: Omit<AnimatedHeroProps, 'path' | 'animation'>) {
  return <AnimatedHero path="/meu-pc" animation="scan" {...props} />;
}
