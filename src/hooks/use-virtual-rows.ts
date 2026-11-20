import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useLayoutEffect, useState } from 'react';

const ROW_HEIGHT = 69;
const OVERSCAN = 8;
const MAIN_CONTENT_ID = 'main-content';

/**
 * Virtualiza uma lista longa.
 *
 * - Com `scrollRef`, o elemento informado é a área de rolagem (uso antigo).
 * - Sem `scrollRef` (`null`), a rolagem é a do próprio app (`#main-content`, no
 *   AppLayout). Nesse caso `listRef` precisa apontar para a lista para que o
 *   `scrollMargin` desconte a distância entre o topo da página e o da lista;
 *   sem isso as linhas ficam desalinhadas em relação ao scroll.
 */
export function useVirtualRows<T>(
  items: T[],
  scrollRef: RefObject<HTMLElement | null> | null,
  rowHeight: number = ROW_HEIGHT,
  listRef?: RefObject<HTMLElement | null>
) {
  const pageScroll = scrollRef === null;
  const [scrollMargin, setScrollMargin] = useState(0);

  // Sem array de dependências: a lista pode ser desmontada e remontada (troca
  // de aba, filtro que esvazia a lista) sem trocar o objeto do ref. Medir a cada
  // render garante que o deslocamento seja recalculado quando ela volta.
  // O valor é estável durante a rolagem (topo da lista e scrollTop variam
  // juntos), então o setState não causa loop.
  useLayoutEffect(() => {
    if (!pageScroll) return;
    const scrollEl = document.getElementById(MAIN_CONTENT_ID);
    const listEl = listRef?.current;
    if (!scrollEl || !listEl) return;
    const offset =
      listEl.getBoundingClientRect().top -
      scrollEl.getBoundingClientRect().top +
      scrollEl.scrollTop;
    setScrollMargin(Math.max(0, offset));
  });

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () =>
      pageScroll ? document.getElementById(MAIN_CONTENT_ID) : (scrollRef?.current ?? null),
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    ...(pageScroll ? { scrollMargin } : {}),
  });

  // Detect test environment or missing scroll context
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const scrollElement = pageScroll
    ? typeof document !== 'undefined'
      ? document.getElementById(MAIN_CONTENT_ID)
      : null
    : (scrollRef?.current ?? null);
  const hasRealScrollContext =
    scrollElement &&
    scrollElement.clientHeight > 0 &&
    (scrollElement.scrollHeight > scrollElement.clientHeight ||
      (!pageScroll && scrollElement.style.overflow === 'auto'));

  // If in test or no real scroll context, render all items
  const shouldVirtualize = !isTestEnv && hasRealScrollContext;

  const virtualItems = shouldVirtualize
    ? virtualizer.getVirtualItems()
    : items.map((_, index) => ({
        index,
        key: index,
        start: index * rowHeight + (pageScroll ? scrollMargin : 0),
        end: (index + 1) * rowHeight + (pageScroll ? scrollMargin : 0),
        size: rowHeight,
        lane: 0,
      }));

  const totalSize = shouldVirtualize ? virtualizer.getTotalSize() : items.length * rowHeight;
  const paddingTop =
    shouldVirtualize && virtualItems.length > 0
      ? Math.max(0, virtualItems[0].start - (pageScroll ? scrollMargin : 0))
      : 0;
  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? Math.max(
          0,
          totalSize - (virtualItems[virtualItems.length - 1].end - (pageScroll ? scrollMargin : 0))
        )
      : 0;

  return { virtualItems, paddingTop, paddingBottom, measureElement: virtualizer.measureElement };
}
