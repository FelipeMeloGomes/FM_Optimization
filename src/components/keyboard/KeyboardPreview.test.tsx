// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeyboardPreview } from './KeyboardPreview';

describe('KeyboardPreview', () => {
  it('mostra a prévia com piscagem e repetição calculadas a partir dos ajustes', () => {
    const { container } = render(
      <KeyboardPreview repeatDelay={1} repeatRate={15} caretBlinkRate={700} />
    );

    expect(screen.getByRole('img', { name: 'Prévia do teclado' })).toBeTruthy();
    const caret = container.querySelector('[data-caret]') as HTMLElement | null;
    expect(caret?.style.animationDuration).toBe('0.7s');
    const repeat = container.querySelector('[data-repeat]') as HTMLElement | null;
    expect(repeat?.style.animationDelay).toBe('0.5s');
    expect(Number.parseFloat(repeat?.style.animationDuration ?? '0')).toBeGreaterThan(0);
  });

  it('exibe os valores escolhidos no rodapé', () => {
    render(<KeyboardPreview repeatDelay={3} repeatRate={31} caretBlinkRate={200} />);

    expect(document.body.textContent).toContain('200 ms');
    expect(document.body.textContent).toContain('1000 ms');
  });
});
