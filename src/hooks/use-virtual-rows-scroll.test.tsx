// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useEffect, useReducer, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão da rolagem: o `<ul>` é renderizado depois do spacer superior, então
 * medir a posição dele devolve `offset da lista + paddingTop`. Como `paddingTop`
 * sai de `item.start - scrollMargin`, uma rolagem que muda o primeiro item visível
 * realimenta o scrollMargin e entra em loop de renderização.
 */

const ROW = 69;
const LIST_OFFSET = 100;
const SCROLL_AT_BOUNDARY = LIST_OFFSET + 2 * ROW;

const { virtualizerOptions, scrollTopState } = vi.hoisted(() => ({
  virtualizerOptions: {} as Record<string, unknown>,
  scrollTopState: { value: 0 },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: Record<string, unknown>) => {
    Object.assign(virtualizerOptions, options);
    const count = Number(options.count ?? 0);
    return {
      getVirtualItems: () => {
        const margin = Number(options.scrollMargin ?? 0);
        const startOf = (index: number) => index * ROW + margin;
        let first = 0;
        while (first < count && startOf(first) + ROW <= scrollTopState.value) first++;
        const index = Math.max(0, first - 1);
        return [
          {
            index,
            key: index,
            start: startOf(index),
            end: startOf(index) + ROW,
            size: ROW,
            lane: 0,
          },
        ];
      },
      getTotalSize: () => count * ROW,
      measureElement: () => {},
    };
  },
}));

import { useVirtualRows } from './use-virtual-rows';

function Harness() {
  const listRef = useRef<HTMLUListElement>(null);
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const { virtualItems, paddingTop, paddingBottom } = useVirtualRows([0, 1, 2], null, ROW, listRef);

  // O virtualizador real se inscreve no scroll e força um render; sem isso o
  // efeito de medição nunca roda depois da rolagem.
  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.addEventListener('scroll', rerender);
    return () => main?.removeEventListener('scroll', rerender);
  }, []);

  return (
    <div>
      <div data-testid="spacer-top" style={{ height: paddingTop }} aria-hidden="true" />
      <ul ref={listRef}>
        {virtualItems.map((item) => (
          <li key={item.key}>{item.index}</li>
        ))}
      </ul>
      <div style={{ height: paddingBottom }} aria-hidden="true" />
    </div>
  );
}

describe('useVirtualRows — rolagem com spacer superior', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    scrollTopState.value = 0;
    Object.keys(virtualizerOptions).forEach((key) => {
      delete virtualizerOptions[key];
    });
    document.body.innerHTML = '';

    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflow = 'auto';
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(main, 'scrollTop', {
      configurable: true,
      get: () => scrollTopState.value,
      set: (value: number) => {
        scrollTopState.value = value;
      },
    });
    document.body.appendChild(main);

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const spacer = this.previousElementSibling as HTMLElement | null;
      const spacerHeight = Number.parseFloat(spacer?.style.height ?? '0') || 0;
      const top =
        this.id === 'main-content'
          ? 0
          : this.tagName === 'UL'
            ? -scrollTopState.value + LIST_OFFSET + spacerHeight
            : 0;
      return {
        top,
        bottom: top + 400,
        left: 0,
        right: 800,
        width: 800,
        height: 400,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('mantém o scrollMargin no deslocamento real da lista ao rolar', () => {
    render(<Harness />);
    expect(virtualizerOptions.scrollMargin).toBe(LIST_OFFSET);

    act(() => {
      scrollTopState.value = SCROLL_AT_BOUNDARY;
      document.getElementById('main-content')?.dispatchEvent(new Event('scroll'));
    });

    expect(virtualizerOptions.scrollMargin).toBe(LIST_OFFSET);
  });
});
