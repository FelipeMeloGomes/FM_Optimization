// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MouseTrailPreview } from './MouseTrailPreview';

function move(container: HTMLElement, x: number, y: number) {
  const area = screen.getByRole('img', { name: 'Prévia do rastro do mouse' });
  fireEvent.pointerMove(area, { clientX: x, clientY: y });
  return container.querySelectorAll('[data-trail-dot]').length;
}

describe('MouseTrailPreview', () => {
  it('desenha um rastro maior quando a velocidade do ponteiro é maior', () => {
    const slow = render(<MouseTrailPreview pointerSpeed={1} enhancedPrecision={false} />);
    const slowDots = move(slow.container, 120, 80);

    slow.unmount();

    const fast = render(<MouseTrailPreview pointerSpeed={20} enhancedPrecision={false} />);
    const fastDots = move(fast.container, 120, 80);

    expect(slowDots).toBeGreaterThan(0);
    expect(fastDots).toBeGreaterThan(slowDots);
  });

  it('informa quando a aceleração do Windows está ativa', () => {
    render(<MouseTrailPreview pointerSpeed={10} enhancedPrecision />);
    expect(screen.getByText('Aceleração ativa')).toBeTruthy();
  });

  it('informa quando o movimento é 1:1 sem aceleração', () => {
    render(<MouseTrailPreview pointerSpeed={10} enhancedPrecision={false} />);
    expect(screen.getByText('Movimento 1:1')).toBeTruthy();
  });
});
