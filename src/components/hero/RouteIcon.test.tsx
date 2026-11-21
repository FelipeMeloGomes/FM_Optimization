// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RouteIcon } from './RouteIcon';

describe('RouteIcon — ícone do badge derivado da rota', () => {
  it('renderiza o ícone da sidebar com a classe do badge', () => {
    const markup = renderToStaticMarkup(<RouteIcon path="/dns" />);

    expect(markup).toContain('lucide-globe');
    expect(markup).toContain('size-4');
    expect(markup).toContain('text-primary');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('aceita classes extras sem perder o ícone da rota', () => {
    const markup = renderToStaticMarkup(<RouteIcon path="/overlay-jogo" className="size-5" />);

    expect(markup).toContain('lucide-crosshair');
    expect(markup).toContain('size-5');
  });
});
