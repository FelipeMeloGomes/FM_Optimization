// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedKeyboard } from './AnimatedKeyboard';

describe('AnimatedKeyboard', () => {
  it('mostra o teclado decorativo animado e escondido de leitores de tela', () => {
    const { container } = render(<AnimatedKeyboard />);

    const visual = container.querySelector('.animate-keyboard-glow');
    expect(visual).not.toBeNull();
    expect(visual?.getAttribute('aria-hidden')).toBe('true');
  });
});
