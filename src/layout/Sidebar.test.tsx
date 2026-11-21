import { Home } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { SettingsProvider } from '../contexts/SettingsContext';
import { Sidebar, SidebarLink } from './Sidebar';

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

function renderLink(collapsed: boolean, label = 'Inicio', to = '/'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[to]}>
      <TooltipProvider>
        <SidebarLink to={to} icon={Home} label={label} collapsed={collapsed} />
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

describe('SidebarLink com rótulo longo', () => {
  const html = renderLink(false, 'Otimização do Sistema', '/cpu');

  it('quebra o nome em vez de cortar o final dele', () => {
    expect(html).toContain('Otimização do Sistema');
    expect(html).not.toContain('whitespace-nowrap');
    expect(html).toContain('break-words');
  });

  it('alinha o ícone com a primeira linha do nome', () => {
    expect(html).toContain('items-start');
    expect(html).not.toContain('items-center');
  });
});

describe('Sidebar recolhida', () => {
  const html = renderSidebar(true);

  it('usa a largura compacta e centraliza os itens', () => {
    expect(html).toContain('w-16');
    expect(html).not.toContain('w-56');
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
    expect(html).toContain('w-56');
    expect(html).not.toContain('w-16');
    expect(html).toContain('pr-1');
    expect(html).not.toContain('pr-0');
    expect(html).not.toContain('mx-auto');
  });
});

describe('Sidebar com seção Formatação', () => {
  const html = renderSidebar(false);

  it('mostra o grupo com Debloat, Essenciais PC e Personalização', () => {
    expect(html).toContain('Formatação');
    for (const path of ['/debloat', '/essenciais', '/personalizacao']) {
      expect(html).toContain(`href="${path}"`);
    }
  });
});

describe('Sidebar com seção Ferramentas', () => {
  const html = renderSidebar(false);

  it('mostra as ferramentas e mantém Privacidade dentro de Sistema', () => {
    expect(html).toContain('Ferramentas');
    expect(html).toContain('href="/comparar-placa"');
    expect(html).toContain('Comparar Placas');
    expect(html).toContain('href="/overlay-jogo"');
    expect(html).toContain('Overlay de jogo');
    expect(html).toContain('href="/privacidade-seguranca"');
    expect(html).not.toContain('Segurança');
  });

  it('não mostra o grupo Programas', () => {
    // Emuladores continua oculto na configuração padrão por causa do Page Lock;
    // a categoria da rota é validada em routes/config.test.ts.
    expect(html).not.toContain('Programas');
  });
});

describe('Sidebar com seção Sistema', () => {
  const html = renderSidebar(false);

  it('mostra Meu PC, Monitor, Mouse e Teclado nessa ordem no grupo Sistema', () => {
    expect(html).toContain('Sistema');
    for (const path of [
      '/armazenamento',
      '/meu-pc',
      '/monitor',
      '/mouse',
      '/privacidade-seguranca',
      '/reparo-do-sistema',
      '/teclado',
      '/utilities',
    ]) {
      expect(html, path).toContain(`href="${path}"`);
    }

    const labels = [
      'Meu PC',
      'Monitor',
      'Mouse',
      'Teclado',
      'Armazenamento',
      'Privacidade',
      'Reparo do sistema',
      'Utilitarios',
    ];
    const positions = labels.map((label) => html.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain('Configurações');
  });
});
