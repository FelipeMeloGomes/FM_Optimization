// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroBanner } from './HeroBanner';

/**
 * O brilho do banner precisa acompanhar o cursor e permanecer enquanto ele
 * está sobre o card. No modo "hover" ele era um sweep único e muito curto.
 */
describe('HeroBanner — brilho que segue o cursor', () => {
  let frames: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    frames = [];
    now = performance.now();

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mantém o brilho visível e o move ao receber pointermove', () => {
    const { container } = render(<HeroBanner image="/x.svg" imageAlt="Ilustração" />);

    const root = container.firstElementChild as HTMLElement;
    const glare = root.querySelector<HTMLElement>('span[style*="mix-blend-mode"]');
    const band = glare?.querySelector<HTMLElement>('span[style*="background"]');

    expect(glare).not.toBeNull();
    expect(band).not.toBeNull();
    expect(glare?.style.opacity).toBe('0');

    const repouso = band?.style.transform ?? '';
    act(() => {
      root.dispatchEvent(new MouseEvent('pointerenter', { clientX: 40, clientY: 20 }));
      root.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 20 }));
    });

    for (let i = 0; i < 30 && frames.length > 0; i++) {
      const callback = frames.shift();
      if (!callback) break;
      now += 50;
      act(() => callback(now));
    }

    expect(band?.style.transform).not.toBe(repouso);
    expect(Number(glare?.style.opacity)).toBeGreaterThan(0);
  });
});
