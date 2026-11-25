// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroDescription } from './HeroBanner';

describe('HeroDescription no SSR', () => {
  it('renderiza o texto como parágrafo estático quando não há DOM', () => {
    const html = renderToStaticMarkup(<HeroDescription text="Personalize o FM Optimize." />);

    expect(html).toContain('<p class="mt-1 max-w-lg text-sm text-muted-foreground">');
    expect(html).toContain('Personalize o FM Optimize.');
    expect(html).not.toContain('blur-text');
  });
});
