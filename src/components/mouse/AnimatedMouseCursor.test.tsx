// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedMouseCursor } from './AnimatedMouseCursor';

describe('AnimatedMouseCursor', () => {
  it('mostra o cursor decorativo com animação e escondido de leitores de tela', () => {
    const { container } = render(<AnimatedMouseCursor />);

    const cursor = container.querySelector('.animate-mouse-glide');
    expect(cursor).not.toBeNull();
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
  });
});
