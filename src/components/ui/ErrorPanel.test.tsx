// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorPanel } from './ErrorPanel';

function render(props: Parameters<typeof ErrorPanel>[0]): string {
  return renderToStaticMarkup(<ErrorPanel {...props} />);
}

describe('ErrorPanel', () => {
  it('renderiza título e mensagem com role=alert e token de erro', () => {
    const html = render({ title: 'Não foi possível carregar', message: 'Falha de comunicação' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Não foi possível carregar');
    expect(html).toContain('Falha de comunicação');
    expect(html).toContain('text-destructive');
  });

  it('inclui o botão de tentar novamente somente com callback', () => {
    const withRetry = render({ title: 'Erro', onRetry: () => {} });
    const withoutRetry = render({ title: 'Erro' });

    expect(withRetry).toContain('Tentar novamente');
    expect(withRetry).toContain('<button');
    expect(withoutRetry).not.toContain('<button');
  });

  it('usa rótulo customizado e respeita disabled', () => {
    const html = render({
      title: 'Erro',
      onRetry: () => {},
      retryLabel: 'Recarregar lista',
      disabled: true,
    });

    expect(html).toContain('Recarregar lista');
    expect(html).toContain('disabled=""');
  });

  it('mantém as classes de tema em cada variante', () => {
    const full = render({ variant: 'full', title: 'Erro', message: 'x' });
    const inline = render({ variant: 'inline', title: 'Erro', message: 'x' });
    const card = render({ variant: 'card', title: 'Erro', message: 'x' });

    expect(full).toContain('text-destructive');
    expect(inline).toContain('text-destructive');
    expect(card).toContain('border-destructive/20');
  });

  it('renderiza ícone informado', () => {
    const html = render({ title: 'Erro', icon: <span data-testid="custom-icon" /> });

    expect(html).toContain('data-testid="custom-icon"');
  });

  it('permite ocultar o ícone padrão', () => {
    const withIcon = render({ title: 'Erro' });
    const withoutIcon = render({ title: 'Erro', icon: false });

    expect(withIcon).toContain('lucide');
    expect(withoutIcon).not.toContain('lucide');
  });

  it('mantém o texto composto quando title e mensagem usam separador', () => {
    const html = render({
      title: 'Não foi possível analisar o PC',
      message: 'acesso negado',
      messageSeparator: ': ',
    });

    expect(html.replace(/<[^>]*>/g, '')).toContain('Não foi possível analisar o PC: acesso negado');
    expect(html).toContain('text-destructive');
  });

  it('renderiza ícone junto do botão de retry', () => {
    const html = render({
      title: 'Erro',
      onRetry: () => {},
      retryIcon: <span data-testid="retry-icon" />,
    });

    expect(html).toContain('data-testid="retry-icon"');
    expect(html).toContain('data-testid="retry-icon"></span>Tentar novamente');
  });

  it('aceita classes próprias e variante do botão', () => {
    const html = render({
      title: 'Erro',
      message: 'detalhe',
      className: 'gap-2',
      titleClassName: 'text-base font-semibold',
      messageClassName: 'flex-1 text-xs',
      onRetry: () => {},
      retryVariant: 'ghost',
      retryClassName: 'px-2',
    });

    expect(html).toContain('gap-2');
    expect(html).toContain('text-base font-semibold');
    expect(html).toContain('flex-1 text-xs');
    expect(html).toContain('hover:bg-accent');
    expect(html).toContain('px-2');
  });
});
