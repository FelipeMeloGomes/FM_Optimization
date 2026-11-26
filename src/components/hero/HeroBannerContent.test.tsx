// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroBannerContent } from './HeroBannerContent';

function render(props: Parameters<typeof HeroBannerContent>[0]): string {
  return renderToStaticMarkup(<HeroBannerContent {...props} />);
}

describe('HeroBannerContent', () => {
  it('renderiza badge com ícone da rota, título, descrição e tokens do tema', () => {
    const html = render({
      badge: 'Debloat',
      path: '/debloat',
      title: 'Debloat de apps do Windows',
      description: 'Inventário dos apps Appx instalados e provisionados.',
    });

    expect(html).toContain('lucide');
    expect(html).toContain('Debloat');
    const titleClass = html.match(/<h2 class="([^"]+)">/)?.[1] ?? '';
    expect(titleClass).toContain('text-lg');
    expect(titleClass).toContain('font-bold');
    expect(titleClass).toContain('text-foreground');
    expect(html).toContain('text-primary');
    expect(html).toContain('text-muted-foreground');
  });

  it('usa título maior quando size é lg', () => {
    const html = render({ title: 'Comparar Placas', description: 'Compare placas.', size: 'lg' });

    expect(html.match(/<h2 class="([^"]+)">/)?.[1] ?? '').toContain('text-2xl');
  });

  it('mantém conteúdo trailing e classes customizadas', () => {
    const html = render({
      title: 'Overlay de jogo',
      description: 'Cadastre seus jogos.',
      titleClassName: 'text-balance',
      descriptionClassName: 'max-w-2xl',
      trailing: <span data-testid="trailing">Configurações</span>,
      titleTrailing: <span data-testid="title-trailing">Opções</span>,
      footer: <span data-testid="footer">Detectada: RTX</span>,
    });

    expect(html).toContain('data-testid="trailing"');
    expect(html).toContain('data-testid="title-trailing"');
    expect(html).toContain('data-testid="footer"');
    expect(html).toContain('text-balance');
    expect(html).toContain('max-w-2xl');
    expect(html).toContain('justify-between');
  });

  it('usa somente tokens do tema', () => {
    const html = render({ title: 'Título', description: 'Descrição' });

    expect(html).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(html).not.toContain('text-black');
    expect(html).not.toContain('bg-white');
    expect(html).not.toContain('text-gray-');
  });
});
