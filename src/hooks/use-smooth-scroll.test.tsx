// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O scroll suave é criado sobre o container real da página: o teste confere as
 * opções passadas ao Lenis, o resize disparado pelo MutationObserver e a
 * destruição (observer + instância) ao desmontar.
 */

type LenisInstance = {
  options: Record<string, unknown>;
  resize: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const lenisState = vi.hoisted(() => ({
  instances: [] as LenisInstance[],
}));

vi.mock('lenis', () => {
  class MockLenis {
    options: Record<string, unknown>;
    resize = vi.fn();
    destroy = vi.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      lenisState.instances.push(this as unknown as LenisInstance);
    }
  }

  return { default: MockLenis };
});

import { useSmoothScroll } from './use-smooth-scroll';

function makeContainer(children = true): HTMLDivElement {
  const el = document.createElement('div');
  if (children) el.appendChild(document.createElement('div'));
  return el;
}

beforeEach(() => {
  lenisState.instances.length = 0;
});

describe('useSmoothScroll', () => {
  it('cria o Lenis sobre o container e seu primeiro filho', () => {
    const container = makeContainer();
    const ref: RefObject<HTMLElement | null> = { current: container };

    renderHook(() => useSmoothScroll(ref));

    expect(lenisState.instances).toHaveLength(1);
    const instance = lenisState.instances[0];
    expect(instance.options.wrapper).toBe(container);
    expect(instance.options.content).toBe(container.firstElementChild);
    expect(instance.options.lerp).toBe(0.14);
    expect(instance.options.smoothWheel).toBe(true);
    expect(instance.options.wheelMultiplier).toBe(1);
    expect(instance.options.autoRaf).toBe(true);
    expect(instance.options.anchors).toBe(true);
  });

  it('passa content indefinido quando o container não tem filhos', () => {
    const container = makeContainer(false);
    const ref: RefObject<HTMLElement | null> = { current: container };

    renderHook(() => useSmoothScroll(ref));

    expect(lenisState.instances[0].options.content).toBeUndefined();
  });

  it('não cria nada quando o container ainda é nulo', () => {
    const ref: RefObject<HTMLElement | null> = { current: null };

    renderHook(() => useSmoothScroll(ref));

    expect(lenisState.instances).toHaveLength(0);
  });

  it('redimensiona quando o conteúdo muda', async () => {
    const container = makeContainer();
    const ref: RefObject<HTMLElement | null> = { current: container };

    renderHook(() => useSmoothScroll(ref));
    const instance = lenisState.instances[0];

    act(() => {
      container.appendChild(document.createElement('span'));
    });

    await waitFor(() => expect(instance.resize).toHaveBeenCalled());
  });

  it('destrói o Lenis ao desmontar', () => {
    const container = makeContainer();
    const ref: RefObject<HTMLElement | null> = { current: container };

    const { unmount } = renderHook(() => useSmoothScroll(ref));
    const instance = lenisState.instances[0];

    unmount();

    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it('desconecta o observer ao desmontar', async () => {
    const container = makeContainer();
    const ref: RefObject<HTMLElement | null> = { current: container };

    const { unmount } = renderHook(() => useSmoothScroll(ref));
    const instance = lenisState.instances[0];

    unmount();
    const callsBefore = instance.resize.mock.calls.length;

    container.appendChild(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.resize.mock.calls.length).toBe(callsBefore);
  });

  it('recria ao trocar de container', () => {
    const first = makeContainer();
    const second = makeContainer();

    const { rerender } = renderHook(
      ({ ref }: { ref: RefObject<HTMLElement | null> }) => useSmoothScroll(ref),
      { initialProps: { ref: { current: first } } }
    );

    rerender({ ref: { current: second } });

    expect(lenisState.instances).toHaveLength(2);
    expect(lenisState.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(lenisState.instances[1].options.wrapper).toBe(second);
    expect(lenisState.instances[1].destroy).not.toHaveBeenCalled();
  });
});
