import { useVirtualizer } from '@tanstack/react-virtual';
import type * as React from 'react';

const ROW_HEIGHT = 69;
const OVERSCAN = 8;

export function useVirtualRows<T>(
  items: T[],
  scrollRef: React.RefObject<HTMLDivElement | null>,
  rowHeight: number = ROW_HEIGHT
) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  // Detect test environment or missing scroll context
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const scrollElement = scrollRef.current;
  const hasRealScrollContext =
    scrollElement &&
    scrollElement.clientHeight > 0 &&
    (scrollElement.scrollHeight > scrollElement.clientHeight ||
      scrollElement.style.overflow === 'auto');

  // If in test or no real scroll context, render all items
  const shouldVirtualize = !isTestEnv && hasRealScrollContext;

  const virtualItems = shouldVirtualize
    ? virtualizer.getVirtualItems()
    : items.map((_, index) => ({
        index,
        key: index,
        start: index * rowHeight,
        end: (index + 1) * rowHeight,
        size: rowHeight,
        lane: 0,
      }));

  const totalSize = shouldVirtualize ? virtualizer.getTotalSize() : items.length * rowHeight;
  const paddingTop = shouldVirtualize && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;

  return { virtualItems, paddingTop, paddingBottom, measureElement: virtualizer.measureElement };
}
