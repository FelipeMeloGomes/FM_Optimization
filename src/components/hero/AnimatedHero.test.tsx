// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  AnimatedCleaner,
  AnimatedCpu,
  AnimatedDashboard,
  AnimatedDebloat,
  AnimatedDns,
  AnimatedEmuladores,
  AnimatedEssentials,
  AnimatedHero,
  AnimatedHistory,
  AnimatedInputLag,
  AnimatedNetwork,
  AnimatedPersonalization,
  AnimatedPrivacySecurity,
  AnimatedRepair,
  AnimatedRestorePoints,
  AnimatedSettings,
  AnimatedSpeedTest,
  AnimatedStartup,
  AnimatedStorage,
  AnimatedUtilities,
  type HeroAnimation,
} from './AnimatedHero';

const ANIMATIONS: HeroAnimation[] = [
  'float',
  'pulse',
  'spin',
  'drift',
  'scan',
  'tilt',
  'drop',
  'storage',
  'repair',
];

describe('AnimatedHero', () => {
  it.each(ANIMATIONS)(
    'aplica a animação %s e esconde o visual de leitores de tela',
    (animation) => {
      const { container } = render(<AnimatedHero icon={Gauge} animation={animation} />);

      const visual = container.querySelector('[data-hero-animation]');
      expect(visual?.getAttribute('data-hero-animation')).toBe(animation);
      expect(visual?.getAttribute('aria-hidden')).toBe('true');
      expect(visual?.className).toContain(`animate-hero-${animation}`);
    }
  );

  it('mantém o brilho e o ícone decorativos, sem controles interativos', () => {
    const { container } = render(
      <AnimatedHero icon={Gauge} animation="scan" className="right-6" />
    );

    expect(container.querySelector('.blur-xl')).not.toBeNull();
    expect(container.querySelector('.animate-hero-scanline')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.firstElementChild?.className).toContain('right-6');
  });

  it('repassa a cor do ícone (ex.: tom dinâmico da CPU)', () => {
    const { container } = render(
      <AnimatedHero icon={Gauge} animation="pulse" iconClassName="text-success" />
    );

    expect(container.querySelector('svg')?.className.baseVal).toContain('text-success');
  });
});

describe('visuais temáticos dos banners', () => {
  const cases = [
    [AnimatedDashboard, 'scan', 'lucide-gauge'],
    [AnimatedCpu, 'pulse', 'lucide-cpu'],
    [AnimatedCleaner, 'scan', 'lucide-eraser'],
    [AnimatedDebloat, 'drop', 'lucide-package-x'],
    [AnimatedDns, 'drift', 'lucide-wifi'],
    [AnimatedNetwork, 'pulse', 'lucide-wifi'],
    [AnimatedSpeedTest, 'scan', 'lucide-activity'],
    [AnimatedEmuladores, 'float', 'lucide-gamepad-2'],
    [AnimatedEssentials, 'drop', 'lucide-monitor-down'],
    [AnimatedHistory, 'spin', 'lucide-history'],
    [AnimatedInputLag, 'drift', 'lucide-mouse-pointer-click'],
    [AnimatedPersonalization, 'float', 'lucide-palette'],
    [AnimatedPrivacySecurity, 'pulse', 'lucide-shield-check'],
    [AnimatedStorage, 'storage', 'lucide-hard-drive'],
    [AnimatedRepair, 'repair', 'lucide-shield-check'],
    [AnimatedRestorePoints, 'tilt', 'lucide-shield'],
    [AnimatedSettings, 'spin', 'lucide-settings'],
    [AnimatedStartup, 'float', 'lucide-rocket'],
    [AnimatedUtilities, 'tilt', 'lucide-wrench'],
  ] as const;

  it.each(cases)('%p usa ícone e movimento próprios', (Component, animation, iconClass) => {
    const { container } = render(<Component />);
    const visual = container.querySelector('[data-hero-animation]');

    expect(visual?.getAttribute('data-hero-animation')).toBe(animation);
    expect(container.querySelector('svg')?.className.baseVal).toContain(iconClass);
  });
});
