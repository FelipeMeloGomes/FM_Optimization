// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useVirtualRows } from './use-virtual-rows';

/**
 * Contrato do hook de virtualização.
 *
 * O hook expõe as linhas que o consumidor deve renderizar e os espaçadores que
 * mantêm a altura total da lista. Quando não há área de rolagem medida (jsdom,
 * primeira renderização, lista fora da viewport) ele precisa devolver todas as
 * linhas com espaçadores zerados — é isso que mantém as páginas renderizando
 * por completo nos testes e evita "buracos" no topo da lista antes da medição.
 */

interface Measured {
  indices: number[];
  starts: number[];
  paddingTop: number;
  paddingBottom: number;
  measureElement: unknown;
}

function Harness({
  items,
  rowHeight,
  onResult,
}: {
  items: number[];
  rowHeight?: number;
  onResult: (result: Measured) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    items,
    scrollRef,
    rowHeight
  );

  onResult({
    indices: virtualItems.map((row) => row.index),
    starts: virtualItems.map((row) => row.start),
    paddingTop,
    paddingBottom,
    measureElement,
  });

  return <div ref={scrollRef} data-testid="scroll" />;
}

function measure(items: number[], rowHeight?: number): Measured {
  let result: Measured | null = null;
  render(
    <Harness
      items={items}
      rowHeight={rowHeight}
      onResult={(next) => {
        result = next;
      }}
    />
  );
  if (!result) throw new Error('o hook não devolveu resultado');
  return result;
}

describe('useVirtualRows — sem área de rolagem medida', () => {
  it('devolve todas as linhas na ordem, sem pular nenhuma', () => {
    const result = measure([0, 1, 2, 3, 4]);

    expect(result.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('devolve lista vazia quando não há itens', () => {
    const result = measure([]);

    expect(result.indices).toEqual([]);
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(0);
  });

  it('não cria espaçadores fantasma no topo ou no fim', () => {
    const result = measure([0, 1, 2]);

    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(0);
  });

  it('usa 69px entre linhas por padrão', () => {
    const result = measure([0, 1, 2]);

    expect(result.starts).toEqual([0, 69, 138]);
  });

  it('respeita a altura de linha informada pelo consumidor', () => {
    const result = measure([0, 1, 2], 44);

    expect(result.starts).toEqual([0, 44, 88]);
  });

  it('expõe o medidor do virtualizador para as linhas', () => {
    const result = measure([0]);

    expect(typeof result.measureElement).toBe('function');
  });
});
