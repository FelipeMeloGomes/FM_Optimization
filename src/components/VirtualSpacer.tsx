export interface VirtualSpacerProps {
  height: number;
  testId?: string;
}

/** Espaço vertical usado pelas listas virtualizadas, fora da árvore de acessibilidade. */
export function VirtualSpacer({ height, testId }: VirtualSpacerProps) {
  return <div data-testid={testId} style={{ height }} aria-hidden="true" />;
}

export interface VirtualTableSpacerProps {
  height: number;
  colSpan: number;
}

/** Equivalente de `VirtualSpacer` para `<tbody>`, sem os estilos de `TableRow`/`TableCell`. */
export function VirtualTableSpacer({ height, colSpan }: VirtualTableSpacerProps) {
  return (
    <tr style={{ height }}>
      <td colSpan={colSpan} />
    </tr>
  );
}
