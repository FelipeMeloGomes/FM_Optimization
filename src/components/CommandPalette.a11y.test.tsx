// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const SCRIPTS = [
  { id: 'cpu-16', name: 'Limpeza Rápida', category: 'Essenciais', subcategory: 'Geral' },
  { id: 'net-1', name: 'DNS Cloudflare', category: 'Rede', subcategory: 'Rede' },
];

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({ state: { status: 'success' }, filteredScripts: SCRIPTS }),
}));
vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({
    state: { status: 'success', data: { memory: { total: '16 GB' } } },
  }),
}));
vi.mock('./ScriptBadge', () => ({ ScriptBadge: () => <span>selo</span> }));

import { CommandPalette } from './CommandPalette';

function renderPalette() {
  return renderToStaticMarkup(<CommandPalette isOpen onClose={vi.fn()} />);
}

function inputTag(html: string): string {
  return html.match(/<input[^>]*>/)?.[0] ?? '';
}

describe('CommandPalette — acessibilidade', () => {
  it('expõe o campo de busca como combobox nomeado e controla a lista', () => {
    const html = renderPalette();
    const input = inputTag(html);

    expect(input).toContain('aria-label="Buscar tweaks"');
    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-expanded="true"');
    expect(input).toContain('aria-controls="command-palette-results"');
    expect(input).toContain('aria-activedescendant="command-palette-option-0"');
  });

  it('mantém foco visível no campo de busca', () => {
    const input = inputTag(renderPalette());

    expect(input).not.toContain('outline-none');
    expect(input).toContain('focus-visible:ring');
  });

  it('usa botão nomeado para fechar o overlay', () => {
    const html = renderPalette();

    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Fechar busca"');
    expect(html).not.toContain('aria-hidden="true" onClick');
  });

  it('anuncia a contagem de resultados e marca a lista e as opções', () => {
    const html = renderPalette();

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('2 resultados');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="command-palette-results"');
    expect(html).toContain('id="command-palette-option-0"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('overscroll-contain');
  });
});
