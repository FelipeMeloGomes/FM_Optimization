// @vitest-environment jsdom
import { render } from '@testing-library/react';
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
  AnimatedMeuPc,
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
      const { container } = render(<AnimatedHero path="/cpu" animation={animation} />);

      const visual = container.querySelector('[data-hero-animation]');
      expect(visual?.getAttribute('data-hero-animation')).toBe(animation);
      expect(visual?.getAttribute('aria-hidden')).toBe('true');
      expect(visual?.className).toContain(`animate-hero-${animation}`);
    }
  );

  it('mantém o brilho e o ícone decorativos, sem controles interativos', () => {
    const { container } = render(<AnimatedHero path="/cpu" animation="scan" className="right-6" />);

    expect(container.querySelector('.blur-xl')).not.toBeNull();
    expect(container.querySelector('.animate-hero-scanline')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.firstElementChild?.className).toContain('right-6');
  });

  it('repassa a cor do ícone (ex.: tom dinâmico da CPU)', () => {
    const { container } = render(
      <AnimatedHero path="/cpu" animation="pulse" iconClassName="text-success" />
    );

    expect(container.querySelector('svg')?.className.baseVal).toContain('text-success');
  });

  it.each(['pulse', 'repair'] as const)(
    'centraliza o ícone e mantém o anel de %s maior que o quadrado do ícone',
    (animation) => {
      const { container } = render(<AnimatedHero path="/cpu" animation={animation} />);
      const visual = container.querySelector('[data-hero-animation]');
      const icon = visual?.querySelector('svg');
      const ring = visual?.querySelector('.rounded-full.border');

      // O ícone precisa ficar no centro dos 80px do contêiner, e não no canto:
      // as decorações (anel, scanline, pontos) são posicionadas em relação ao centro.
      expect(icon?.parentElement?.className).toContain('flex');
      expect(icon?.parentElement?.className).toContain('items-center');
      expect(icon?.parentElement?.className).toContain('justify-center');

      // Anel de 80px (inset-0) x ícone de 56px: a diagonal do quadrado do
      // ícone (≈79px) cabe no diâmetro do círculo, então não sobra ponta fora.
      expect(ring?.className).toContain('inset-0');
      expect(icon?.getAttribute('class')).toContain('size-14');
    }
  );
});

describe('visuais temáticos dos banners', () => {
  const cases = [
    [AnimatedDashboard, 'scan', 'lucide-home'],
    [AnimatedCpu, 'pulse', 'lucide-gauge'],
    [AnimatedCleaner, 'scan', 'lucide-eraser'],
    [AnimatedDebloat, 'drop', 'lucide-package-x'],
    [AnimatedDns, 'drift', 'lucide-globe'],
    [AnimatedNetwork, 'pulse', 'lucide-wifi'],
    [AnimatedSpeedTest, 'scan', 'lucide-activity'],
    [AnimatedEmuladores, 'float', 'lucide-gamepad-2'],
    [AnimatedEssentials, 'drop', 'lucide-monitor-down'],
    [AnimatedHistory, 'spin', 'lucide-clock'],
    [AnimatedInputLag, 'drift', 'lucide-mouse-pointer-click'],
    [AnimatedPersonalization, 'float', 'lucide-palette'],
    [AnimatedPrivacySecurity, 'pulse', 'lucide-shield-check'],
    [AnimatedStorage, 'storage', 'lucide-hard-drive'],
    [AnimatedRepair, 'repair', 'lucide-hammer'],
    [AnimatedRestorePoints, 'tilt', 'lucide-shield'],
    [AnimatedSettings, 'spin', 'lucide-settings'],
    [AnimatedStartup, 'float', 'lucide-rocket'],
    [AnimatedUtilities, 'tilt', 'lucide-wrench'],
    [AnimatedMeuPc, 'scan', 'lucide-circuit-board'],
  ] as const;

  it.each(cases)('%p usa ícone e movimento da rota', (Component, animation, iconClass) => {
    const { container } = render(<Component />);
    const visual = container.querySelector('[data-hero-animation]');

    expect(visual?.getAttribute('data-hero-animation')).toBe(animation);
    expect(container.querySelector('svg')?.className.baseVal).toContain(iconClass);
  });
});
