import { Home } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { SettingsProvider } from '../contexts/SettingsContext';
import { Sidebar, SidebarLink } from './Sidebar';

// O tema importa o BatmanBackground, que instancia `Path2D` no topo do módulo —
// uma API de canvas inexistente no ambiente node do Vitest. O fundo não
// influencia a sidebar, então basta não carregá-lo.
vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

/**
 * Regressão do alinhamento da sidebar recolhida.
 *
 * O `TooltipTrigger asChild` do Radix concatena o `className` do filho em uma
 * string. Como o `NavLink` recebe uma função, ela virava o próprio código-fonte
 * no atributo `class`: `gap-3`/`px-3` sobreviviam e `gap-0`/`px-0` não, jogando
 * os ícones 6,5 px para a esquerda em relação ao ícone de busca.
 *
 * O SSR executa o mesmo merge do Radix, então o HTML gerado denuncia a regressão
 * sem precisar de DOM ou navegador.
 */

function renderLink(collapsed: boolean): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <TooltipProvider>
        <SidebarLink to="/" icon={Home} label="Inicio" collapsed={collapsed} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

function renderSidebar(collapsed: boolean): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <SettingsProvider>
        <Sidebar openCommandPalette={() => {}} defaultCollapsed={collapsed} />
      </SettingsProvider>
    </MemoryRouter>
  );
}

describe('SidebarLink recolhido', () => {
  it('aplica as classes compactas e não serializa a função de className', () => {
    const html = renderLink(true);

    expect(html).toContain('gap-0');
    expect(html).toContain('px-0');
    expect(html).toContain('size-9');

    // Regressão: o Radix Slot convertia a função em texto dentro do atributo
    // class, e as classes reais vinham dos tokens desse texto.
    expect(html).not.toContain('isActive');
    expect(html).not.toContain('cn(');
    expect(html).not.toContain('=>');
  });

  it('envolve o link no span que serve de trigger do tooltip', () => {
    const html = renderLink(true);

    expect(html).toMatch(/<span[^>]*class="[^"]*w-full[^"]*justify-center[^"]*"[^>]*><a /);
  });
});

describe('SidebarLink expandido', () => {
  it('mantém o espaçamento normal entre ícone e rótulo', () => {
    const html = renderLink(false);

    expect(html).toContain('gap-3');
    expect(html).toContain('px-3');
    expect(html).not.toContain('gap-0');
    expect(html).not.toContain('mx-auto');
  });
});

describe('Sidebar recolhida', () => {
  const html = renderSidebar(true);

  it('usa a largura compacta e centraliza os itens', () => {
    expect(html).toContain('w-16');
    expect(html).not.toContain('w-48');
    expect(html).toContain('pr-0');
    expect(html).not.toContain('pr-1');
  });

  it('centraliza busca e botão de recolher', () => {
    // mx-auto aparece na busca e no botão de recolher; é o que os alinha com
    // o logo e com os ícones do menu.
    expect((html.match(/mx-auto/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('mantém os separadores ocupando a largura da coluna', () => {
    expect(html).toContain('my-2 w-full border-t');
  });
});

describe('Sidebar expandida', () => {
  const html = renderSidebar(false);

  it('volta para a largura e o espaçamento normais', () => {
    expect(html).toContain('w-48');
    expect(html).not.toContain('w-16');
    expect(html).toContain('pr-1');
    expect(html).not.toContain('pr-0');
    expect(html).not.toContain('mx-auto');
  });
});
