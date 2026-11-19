// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedDashboard } from './AnimatedHero';
import { HeroBanner } from './HeroBanner';

describe('HeroBanner', () => {
  it('renderiza o visual animado e o conteúdo da página dentro do gradiente padrão', () => {
    const { container } = render(
      <HeroBanner visual={<AnimatedDashboard />}>
        <h2>Painel do Sistema</h2>
      </HeroBanner>
    );

    const shell = container.firstElementChild;
    expect(shell?.className).toContain('bg-gradient-to-br');
    expect(shell?.querySelector('[data-hero-animation="scan"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Painel do Sistema' })).toBeTruthy();
  });

  it('aceita classes próprias no contêiner e no conteúdo', () => {
    const { container } = render(
      <HeroBanner
        visual={<span data-testid="visual" />}
        className="border-success/20 bg-gradient-to-br to-transparent"
        contentClassName="p-4"
      >
        <p>Desempenho</p>
      </HeroBanner>
    );

    const shell = container.firstElementChild;
    expect(shell?.className).toContain('border-success/20');
    expect(shell?.className).not.toContain('border-primary/20');
    expect(shell?.querySelector('.p-4')).not.toBeNull();
    expect(shell?.querySelector('[data-testid="visual"]')).not.toBeNull();
  });
});
