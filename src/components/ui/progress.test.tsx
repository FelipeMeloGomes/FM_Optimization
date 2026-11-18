import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Progress } from './progress';

describe('Progress', () => {
  it('aceita nome acessível pela prop ariaLabel', () => {
    const html = renderToStaticMarkup(<Progress value={42} ariaLabel="CPU: 42%" />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="CPU: 42%"');
  });

  it('mantém compatibilidade com aria-label direto', () => {
    const html = renderToStaticMarkup(<Progress value={10} aria-label="RAM: 10%" />);

    expect(html).toContain('aria-label="RAM: 10%"');
  });
});
