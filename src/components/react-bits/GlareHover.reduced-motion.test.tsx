// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlareHover from './GlareHover';

/**
 * No Electron, `prefers-reduced-motion` vem como `reduce` no primeiro frame e
 * só depois passa a refletir a preferência real. O brilho não pode congelar a
 * animação com o valor lido na montagem: ele precisa consultar no evento.
 */
describe('GlareHover — prefers-reduced-motion reconsultado no hover', () => {
  let reduced: boolean;
  let frames: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    reduced = true;
    frames = [];
    now = performance.now();

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
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

    class ObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('ResizeObserver', ObserverStub);
    vi.stubGlobal('IntersectionObserver', ObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('move a faixa de brilho quando a preferência mudou após a montagem', () => {
    const { container } = render(<GlareHover>Conteúdo</GlareHover>);
    const root = container.firstElementChild as HTMLElement;
    const band = root.querySelector<HTMLElement>('span[style*="background"]');

    expect(band).not.toBeNull();
    const repouso = band?.style.transform ?? '';
    expect(repouso).toContain('translateX(');

    // Era "reduce" na montagem; o Electron corrige a preferência em seguida.
    reduced = false;
    act(() => {
      root.dispatchEvent(new MouseEvent('pointerenter', { clientX: 40, clientY: 40 }));
    });

    for (let i = 0; i < 20 && frames.length > 0; i++) {
      const callback = frames.shift();
      if (!callback) break;
      now += 40;
      act(() => callback(now));
    }

    expect(band?.style.transform).not.toBe(repouso);
  });
});
