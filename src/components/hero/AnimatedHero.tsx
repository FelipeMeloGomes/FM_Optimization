import {
  Activity,
  Cpu,
  Eraser,
  Gamepad2,
  Gauge,
  HardDrive,
  History,
  type LucideIcon,
  MonitorDown,
  MousePointerClick,
  PackageX,
  Palette,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  Wifi,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

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
  icon: LucideIcon;
  animation: HeroAnimation;
  /** Cor do ícone (ex.: o tom dinâmico da página CPU). */
  iconClassName?: string;
  className?: string;
}

/**
 * Visual decorativo do banner. Animação CSS pura: não afeta nenhum serviço,
 * configuração ou dado do sistema — é o mesmo padrão do cursor/teclado/monitor.
 */
export function AnimatedHero({
  icon: Icon,
  animation,
  iconClassName,
  className,
}: AnimatedHeroProps) {
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

/* Cada página ganha um visual próprio, no mesmo estilo de Mouse/Monitor/Teclado. */
export function AnimatedDashboard(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Gauge} animation="scan" {...props} />;
}

export function AnimatedCpu(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Cpu} animation="pulse" {...props} />;
}

export function AnimatedCleaner(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Eraser} animation="scan" {...props} />;
}

export function AnimatedDebloat(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={PackageX} animation="drop" {...props} />;
}

export function AnimatedDns(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Wifi} animation="drift" {...props} />;
}

export function AnimatedNetwork(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Wifi} animation="pulse" {...props} />;
}

export function AnimatedSpeedTest(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Activity} animation="scan" {...props} />;
}

export function AnimatedEmuladores(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Gamepad2} animation="float" {...props} />;
}

export function AnimatedEssentials(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={MonitorDown} animation="drop" {...props} />;
}

export function AnimatedHistory(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={History} animation="spin" {...props} />;
}

export function AnimatedInputLag(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={MousePointerClick} animation="drift" {...props} />;
}

export function AnimatedPersonalization(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Palette} animation="float" {...props} />;
}

export function AnimatedPrivacySecurity(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={ShieldCheck} animation="pulse" {...props} />;
}

export function AnimatedStorage(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={HardDrive} animation="storage" {...props} />;
}

export function AnimatedRepair(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={ShieldCheck} animation="repair" {...props} />;
}

export function AnimatedRestorePoints(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Shield} animation="tilt" {...props} />;
}

export function AnimatedSettings(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Settings} animation="spin" {...props} />;
}

export function AnimatedStartup(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Rocket} animation="float" {...props} />;
}

export function AnimatedUtilities(props: Omit<AnimatedHeroProps, 'icon' | 'animation'>) {
  return <AnimatedHero icon={Wrench} animation="tilt" {...props} />;
}
