// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { virtualizerOptions } = vi.hoisted(() => ({
  virtualizerOptions: {} as Record<string, unknown>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: Record<string, unknown>) => {
    Object.assign(virtualizerOptions, options);
    return {
      getVirtualItems: () => [],
      getTotalSize: () => 0,
      measureElement: () => {},
    };
  },
}));

import { useVirtualRows } from './use-virtual-rows';

function Harness() {
  const listRef = useRef<HTMLUListElement>(null);
  const { virtualItems, paddingTop, paddingBottom } = useVirtualRows([0, 1, 2], null, 50, listRef);
  return (
    <>
      <ul ref={listRef} data-testid="list" />
      <span data-testid="rows">{virtualItems.length}</span>
      <span data-testid="padding">{`${paddingTop}/${paddingBottom}`}</span>
    </>
  );
}

function ToggleHarness() {
  const listRef = useRef<HTMLUListElement>(null);
  const [visible, setVisible] = useState(true);
  useVirtualRows([0, 1], null, 50, listRef);
  return (
    <>
      <button type="button" data-testid="toggle" onClick={() => setVisible((value) => !value)}>
        alternar
      </button>
      {visible && <ul ref={listRef} data-testid="list" />}
    </>
  );
}

describe('useVirtualRows — rolagem da página', () => {
  beforeEach(() => {
    Object.keys(virtualizerOptions).forEach((key) => {
      delete virtualizerOptions[key];
    });
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa #main-content como elemento de rolagem quando não há scrollRef', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);

    render(<Harness />);

    const getScrollElement = virtualizerOptions.getScrollElement as () => HTMLElement | null;
    expect(getScrollElement()).toBe(main);
    expect(virtualizerOptions.scrollMargin).toBe(0);
  });

  it('não quebra quando a página ainda não montou o main', () => {
    render(<Harness />);

    const getScrollElement = virtualizerOptions.getScrollElement as () => HTMLElement | null;
    expect(getScrollElement()).toBeNull();
  });

  it('devolve todas as linhas fora do ambiente de teste de layout', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);

    const { getByTestId } = render(<Harness />);

    expect(getByTestId('rows').textContent).toBe('3');
    expect(getByTestId('padding').textContent).toBe('0/0');
  });

  it('remede o deslocamento quando a lista é desmontada e remontada', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);

    let listTop = 100;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const top = this.tagName === 'UL' ? listTop : 0;
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

    const { getByTestId } = render(<ToggleHarness />);
    expect(virtualizerOptions.scrollMargin).toBe(100);

    listTop = 250;
    fireEvent.click(getByTestId('toggle'));
    fireEvent.click(getByTestId('toggle'));

    expect(virtualizerOptions.scrollMargin).toBe(250);
  });
});
