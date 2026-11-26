// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AsyncButton } from './AsyncButton';

describe('AsyncButton', () => {
  it('mostra os filhos completos e nenhum rótulo de carregamento quando ocioso', () => {
    const html = renderToStaticMarkup(
      <AsyncButton loading={false} loadingLabel="Removendo…">
        <span className="hidden sm:inline">Remover selecionados</span>
      </AsyncButton>
    );

    expect(html).toContain('hidden sm:inline');
    expect(html).toContain('Remover selecionados');
    expect(html).not.toContain('Removendo…');
    expect(html).not.toContain('aria-busy');
  });

  it('substitui os filhos pelo rótulo de carregamento e desabilita o botão', () => {
    const html = renderToStaticMarkup(
      <AsyncButton loading loadingLabel="Limpando…">
        <span>Limpar selecionados</span>
      </AsyncButton>
    );

    expect(html).toContain('Limpando…');
    expect(html).not.toContain('Limpar selecionados');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });

  it('usa loader animado e decorativo por padrão', () => {
    const html = renderToStaticMarkup(
      <AsyncButton loading loadingLabel="Aplicando…">
        Aplicar
      </AsyncButton>
    );

    expect(html).toContain('lucide-loader-circle');
    expect(html).toContain('animate-spin');
    expect(html).toContain('aria-hidden="true"');
  });

  it('aceita ícone de carregamento customizado', () => {
    const html = renderToStaticMarkup(
      <AsyncButton loading loadingLabel="Parando…" busyIcon={<span data-testid="busy" />}>
        Parar
      </AsyncButton>
    );

    expect(html).toContain('data-testid="busy"');
    expect(html).not.toContain('lucide-loader-circle');
  });

  it('repassa variante, tamanho, classe, clique e ref ao botão', () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();

    render(
      <AsyncButton
        loading={false}
        loadingLabel="Analisando…"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onClick}
        ref={ref}
      >
        Analisar PC
      </AsyncButton>
    );
    const button = screen.getByRole('button', { name: 'Analisar PC' });

    expect(ref.current).toBe(button);
    expect(button.className).toContain('border-input');
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('gap-1.5');
    expect(button.className).not.toContain('#');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('mantém desabilitado pelo chamador mesmo quando ocioso', () => {
    const html = renderToStaticMarkup(
      <AsyncButton loading={false} loadingLabel="Carregando…" disabled>
        Desativar
      </AsyncButton>
    );

    expect(html).toContain('disabled=""');
    expect(html).not.toContain('aria-busy');
  });
});
