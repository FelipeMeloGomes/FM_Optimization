// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedNumber } from './AnimatedNumber';

describe('AnimatedNumber', () => {
  it('anuncia o valor final de imediato enquanto os dígitos animam', () => {
    const { rerender } = render(<AnimatedNumber value={10} suffix=" / 20" />);

    rerender(<AnimatedNumber value={16} suffix=" / 20" />);

    const announced = screen.getByText('16 / 20');
    expect(announced.className).toContain('sr-only');
    expect(announced.parentElement?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('mantém o sufixo no valor anunciado', () => {
    render(<AnimatedNumber value={300} suffix=" ms" />);

    expect(screen.getByText('300 ms')).toBeTruthy();
  });
});
