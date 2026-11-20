// @vitest-environment node

import { useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useVirtualRows } from './use-virtual-rows';

/**
 * Regressão SSR: páginas renderizadas com `renderToStaticMarkup` não têm
 * `document`. No modo de rolagem da página (`scrollRef === null`) o hook precisa
 * devolver todas as linhas sem tentar consultar o DOM.
 */

function SsrHarness() {
  const listRef = useRef<HTMLUListElement>(null);
  const { virtualItems, paddingTop, paddingBottom } = useVirtualRows([0, 1, 2], null, 50, listRef);

  return (
    <ul ref={listRef}>
      {virtualItems.map((row) => (
        <li key={row.key} data-index={row.index} />
      ))}
      <li data-padding={`${paddingTop}/${paddingBottom}`} />
    </ul>
  );
}

describe('useVirtualRows — renderização no servidor', () => {
  it('devolve todas as linhas sem acessar document', () => {
    const html = renderToStaticMarkup(<SsrHarness />);

    expect(html.match(/data-index=/g)).toHaveLength(3);
    expect(html).toContain('data-padding="0/0"');
  });
});
