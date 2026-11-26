// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

function inputTag(html: string): string {
  return html.match(/<input[^>]*>/)?.[0] ?? '';
}

describe('SearchInput', () => {
  it('nomeia o campo e repassa placeholder, valor e onChange', () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        ariaLabel="Buscar apps"
        placeholder="Buscar por nome ou pacote…"
        value="abc"
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText('Buscar apps') as HTMLInputElement;
    expect(input.placeholder).toBe('Buscar por nome ou pacote…');
    expect(input.value).toBe('abc');

    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('usa type search por padrão e permite type text para o combobox', () => {
    const html = renderToStaticMarkup(<SearchInput ariaLabel="Buscar apps" />);
    const bareHtml = renderToStaticMarkup(<SearchInput ariaLabel="Buscar" type="text" bare />);

    expect(inputTag(html)).toContain('type="search"');
    expect(inputTag(bareHtml)).toContain('type="text"');
  });

  it('desenha o ícone decorativo com tokens do tema e padding padrão', () => {
    const html = renderToStaticMarkup(<SearchInput ariaLabel="Buscar apps" />);
    const input = inputTag(html);

    expect(html).toContain('lucide-search');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('left-3');
    expect(html).toContain('size-4');
    expect(input).toContain('pl-9');
    expect(html).not.toContain('#');
  });

  it('aplica o modo compacto ao ícone e ao campo', () => {
    const html = renderToStaticMarkup(<SearchInput ariaLabel="Buscar" compact />);
    const input = inputTag(html);

    expect(html).toContain('left-2.5');
    expect(html).toContain('size-3.5');
    expect(input).toContain('h-9');
    expect(input).toContain('pl-8');
  });

  it('coloca wrapperClassName no wrapper e className no input', () => {
    const html = renderToStaticMarkup(
      <SearchInput ariaLabel="Buscar" wrapperClassName="w-full sm:max-w-xs" className="custom" />
    );

    expect(html).toContain('class="relative w-full sm:max-w-xs"');
    expect(inputTag(html)).toContain('custom');
  });

  it('preenche inputRef e ref com o mesmo elemento', () => {
    const inputRef = createRef<HTMLInputElement>();
    const forwardedRef = createRef<HTMLInputElement>();

    render(<SearchInput ariaLabel="Buscar" inputRef={inputRef} ref={forwardedRef} />);

    expect(inputRef.current).toBe(screen.getByLabelText('Buscar'));
    expect(forwardedRef.current).toBe(inputRef.current);
  });

  it('repassa atributos de combobox ao input', () => {
    const html = renderToStaticMarkup(
      <SearchInput
        ariaLabel="Buscar tweaks"
        bare
        role="combobox"
        aria-expanded="true"
        aria-controls="resultados"
        aria-activedescendant="opcao-0"
      />
    );
    const input = inputTag(html);

    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-expanded="true"');
    expect(input).toContain('aria-controls="resultados"');
    expect(input).toContain('aria-activedescendant="opcao-0"');
  });

  it('remove o visual de campo no modo bare sem descartar classes do chamador', () => {
    const html = renderToStaticMarkup(
      <SearchInput
        ariaLabel="Buscar"
        bare
        className="flex-1 bg-transparent text-foreground focus-visible:ring-2"
      />
    );
    const input = inputTag(html);

    expect(input).not.toContain('border-input');
    expect(input).not.toContain('bg-background');
    expect(input).not.toContain('h-10');
    expect(input).toContain('flex-1');
    expect(input).toContain('bg-transparent');
    expect(input).toContain('focus-visible:ring-2');
  });
});
