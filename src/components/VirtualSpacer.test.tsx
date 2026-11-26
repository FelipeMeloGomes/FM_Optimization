// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VirtualSpacer, VirtualTableSpacer } from './VirtualSpacer';

describe('VirtualSpacer', () => {
  it('renderiza o spacer de lista com testId, altura e aria-hidden', () => {
    render(<VirtualSpacer height={69} testId="virtual-spacer-top" />);

    const spacer = screen.getByTestId('virtual-spacer-top');
    expect(spacer.tagName).toBe('DIV');
    expect(spacer.getAttribute('aria-hidden')).toBe('true');
    expect(spacer.getAttribute('style')).toBe('height: 69px;');
    expect(spacer.className).toBe('');
    expect(spacer.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|white|black|gray-/i);
  });

  it('omite data-testid quando não informado', () => {
    const { container } = render(<VirtualSpacer height={138} />);

    const spacer = container.firstElementChild as HTMLElement;
    expect(spacer.hasAttribute('data-testid')).toBe(false);
    expect(spacer.style.height).toBe('138px');
    expect(spacer.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('VirtualTableSpacer', () => {
  it('renderiza tr/td sem testid e sem classes de cor', () => {
    const { container } = render(
      <table>
        <tbody>
          <VirtualTableSpacer height={72} colSpan={4} />
        </tbody>
      </table>
    );

    const row = container.querySelector('tr');
    expect(row?.getAttribute('style')).toBe('height: 72px;');
    expect(row?.hasAttribute('data-testid')).toBe(false);
    expect(row?.className).toBe('');

    const cell = row?.querySelector('td');
    expect(cell?.getAttribute('colspan')).toBe('4');
    expect(cell?.hasAttribute('data-testid')).toBe(false);
    expect(cell?.className).toBe('');
    expect(cell?.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|white|black|gray-/i);
  });

  it('aceita colSpan diferente para a tabela de serviços', () => {
    const { container } = render(
      <table>
        <tbody>
          <VirtualTableSpacer height={144} colSpan={5} />
        </tbody>
      </table>
    );

    expect(container.querySelector('td')?.getAttribute('colspan')).toBe('5');
    expect(container.querySelector('tr')?.style.height).toBe('144px');
  });
});
