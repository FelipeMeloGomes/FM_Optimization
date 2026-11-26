// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GlareHover from './GlareHover';

/**
 * O brilho é gerado por `color-mix` inline. Um default `#ffffff` fugia da regra
 * de cores fixas e não acompanhava o tema; aqui o comportamento observado é a
 * cor efetivamente aplicada às faixas de brilho.
 */
describe('GlareHover — cor do brilho', () => {
  it('usa a cor primária do tema quando nenhuma cor é informada', () => {
    const { container } = render(<GlareHover>Conteúdo</GlareHover>);

    const bands = Array.from(
      container.querySelectorAll<HTMLElement>('span[style*="background: linear-gradient"]')
    );
    expect(bands.length).toBeGreaterThan(0);

    for (const band of bands) {
      const background = band.getAttribute('style') ?? '';
      expect(background).toContain('var(--color-primary)');
      expect(background).not.toContain('#ffffff');
    }
  });
});
