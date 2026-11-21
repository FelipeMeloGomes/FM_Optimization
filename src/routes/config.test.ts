import { describe, expect, it } from 'vitest';
import { getShortcutRoute, PAGE_ROUTES } from '../hooks/use-keyboard-shortcuts';
import { CATEGORY_ROUTES } from '../lib/category-routes';
import { ALWAYS_VISIBLE_ROUTES } from '../lib/page-lock';
import { CATEGORIES, ROUTES, routesByCategory } from './config';

/**
 * Menu, Ctrl+K, atalhos e Page Lock precisam enxergar o mesmo conjunto de
 * paginas. Estes testes travam a fonte unica (`ROUTES`) contra as listas que
 * antes eram mantidas a mao.
 */
describe('rotas da aplicacao', () => {
  const paths = ROUTES.map((route) => route.path);

  it('nao tem caminhos duplicados', () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('rotula /cpu como Otimização do Sistema sem mudar a rota', () => {
    // A rota fica estavel para Page Lock e links antigos; so o rotulo muda.
    const route = ROUTES.find((r) => r.path === '/cpu');
    expect(route?.label).toBe('Otimização do Sistema');
    expect(route?.category).toBe('desempenho');
  });

  it('mantém a categoria da sidebar com o nome original', () => {
    // A renomeação é só da página: o agrupamento da sidebar continua Desempenho.
    expect(CATEGORIES.find((category) => category.id === 'desempenho')?.label).toBe('Desempenho');
  });

  it('inclui Personalizacao como pagina propria e protegida', () => {
    const route = ROUTES.find((r) => r.path === '/personalizacao');
    expect(route?.label).toBe('Personalização');
    expect(route?.category).toBe('formatacao');
    expect(route?.protected).toBe(true);
  });

  it('reúne Debloat, Essenciais PC e Personalização na seção Formatação', () => {
    expect(CATEGORIES.find((category) => category.id === 'formatacao')?.label).toBe('Formatação');
    expect(routesByCategory('formatacao').map((route) => route.path)).toEqual([
      '/debloat',
      '/essenciais',
      '/personalizacao',
    ]);
    expect(routesByCategory('manutencao').map((route) => route.path)).toEqual(['/cleaner']);
  });

  it('usa Sistema para Meu PC, os periféricos e Configurações para o rodapé', () => {
    expect(CATEGORIES.find((category) => category.id === 'sistema')?.label).toBe('Sistema');
    expect(CATEGORIES.find((category) => category.id === 'configuracoes')?.label).toBe(
      'Configurações'
    );

    expect(routesByCategory('sistema').map((route) => route.path)).toEqual([
      '/meu-pc',
      '/monitor',
      '/mouse',
      '/teclado',
      '/armazenamento',
      '/emuladores',
      '/privacidade-seguranca',
      '/reparo-do-sistema',
      '/utilities',
    ]);
    expect(
      routesByCategory('configuracoes')
        .map((route) => route.path)
        .sort()
    ).toEqual(['/history', '/restore-points', '/settings']);

    for (const path of ['/mouse', '/monitor', '/teclado']) {
      const route = ROUTES.find((r) => r.path === path);
      expect(route?.category, path).toBe('sistema');
      expect(route?.protected, path).toBe(true);
    }
    expect(ROUTES.find((r) => r.path === '/mouse')?.label).toBe('Mouse');
    expect(CATEGORY_ROUTES.Mouse).toBe('/mouse');
    expect(CATEGORY_ROUTES.Monitor).toBe('/monitor');
    expect(CATEGORY_ROUTES.Teclado).toBe('/teclado');
  });

  it('registra Meu PC em Sistema como página protegida', () => {
    const meuPc = ROUTES.find((r) => r.path === '/meu-pc');
    expect(meuPc?.label).toBe('Meu PC');
    expect(meuPc?.category).toBe('sistema');
    expect(meuPc?.protected).toBe(true);
  });

  it('tem DNS como pagina propria na categoria Rede, sem tirar os scripts de /rede', () => {
    const dns = ROUTES.find((r) => r.path === '/dns');
    expect(dns?.label).toBe('DNS');
    expect(dns?.category).toBe('rede');
    expect(dns?.protected).toBe(true);

    const internet = ROUTES.find((r) => r.path === '/rede');
    expect(internet?.label).toBe('Internet');
    expect(internet?.category).toBe('rede');
    expect(CATEGORIES.find((category) => category.id === 'rede')?.label).toBe('Rede');
  });

  it('tem Armazenamento e Reparo do sistema como páginas próprias em Sistema', () => {
    const sistema = routesByCategory('sistema').map((route) => route.path);
    expect(sistema).toContain('/armazenamento');
    expect(sistema).toContain('/reparo-do-sistema');

    for (const path of ['/armazenamento', '/reparo-do-sistema']) {
      const route = ROUTES.find((r) => r.path === path);
      expect(route?.category, path).toBe('sistema');
      expect(route?.protected, path).toBe(true);
    }
  });

  it('usa um icone distinto para cada pagina da sidebar', () => {
    const seen = new Map<(typeof ROUTES)[number]['icon'], string>();
    const duplicates: string[] = [];

    for (const route of ROUTES) {
      const first = seen.get(route.icon);
      if (first) duplicates.push(`${first} e ${route.path}`);
      else seen.set(route.icon, route.path);
    }

    expect(duplicates).toEqual([]);
  });

  it('tem Velocidade como pagina propria na categoria Rede', () => {
    const route = ROUTES.find((r) => r.path === '/velocidade');
    expect(route?.label).toBe('Velocidade');
    expect(route?.category).toBe('rede');
    expect(route?.protected).toBe(true);
  });

  it('nao tem mais /tweaks nem /apps', () => {
    expect(paths).not.toContain('/tweaks');
    expect(paths).not.toContain('/apps');
  });

  it('coloca Restauracao e Historico em Configurações', () => {
    expect(routesByCategory('configuracoes').map((r) => r.path)).toContain('/restore-points');
    expect(routesByCategory('configuracoes').map((r) => r.path)).toContain('/history');
  });

  it('move Privacidade para Sistema e remove a categoria Segurança vazia', () => {
    const privacidade = ROUTES.find((r) => r.path === '/privacidade-seguranca');
    expect(privacidade?.label).toBe('Privacidade');
    expect(privacidade?.category).toBe('sistema');
    expect(privacidade?.protected).toBe(true);
    expect(routesByCategory('sistema').map((r) => r.path)).toContain('/privacidade-seguranca');
    expect(CATEGORIES.map((c) => c.id)).not.toContain('seguranca');
  });

  it('move Emuladores para Sistema e remove a categoria Programas vazia', () => {
    const emuladores = ROUTES.find((r) => r.path === '/emuladores');
    expect(emuladores?.label).toBe('Emuladores');
    expect(emuladores?.category).toBe('sistema');
    expect(emuladores?.protected).toBe(true);
    expect(routesByCategory('sistema').map((r) => r.path)).toContain('/emuladores');
    expect(CATEGORIES.map((c) => c.id)).not.toContain('programas');
  });

  it('recria a categoria Ferramentas com o comparador e o overlay, e mantém Meu PC e os periféricos primeiro em Sistema', () => {
    expect(CATEGORIES.find((category) => category.id === 'ferramentas')?.label).toBe('Ferramentas');
    expect(routesByCategory('ferramentas').map((route) => route.path)).toEqual([
      '/comparar-placa',
      '/overlay-jogo',
    ]);

    const comparador = ROUTES.find((route) => route.path === '/comparar-placa');
    expect(comparador?.label).toBe('Comparar Placas');
    expect(comparador?.category).toBe('ferramentas');
    expect(comparador?.protected).toBeFalsy();

    const overlay = ROUTES.find((route) => route.path === '/overlay-jogo');
    expect(overlay?.label).toBe('Overlay de jogo');
    expect(overlay?.category).toBe('ferramentas');
    expect(overlay?.protected).toBeFalsy();

    const labels = routesByCategory('sistema').map((route) => route.label);
    expect(labels).toEqual([
      'Meu PC',
      'Monitor',
      'Mouse',
      'Teclado',
      'Armazenamento',
      'Emuladores',
      'Privacidade',
      'Reparo do sistema',
      'Utilitarios',
    ]);
  });

  it('todo destino de categoria do Ctrl+K existe no menu', () => {
    for (const [category, path] of Object.entries(CATEGORY_ROUTES)) {
      expect(paths, category).toContain(path);
    }
  });

  it('as rotas sempre visiveis existem', () => {
    for (const path of ALWAYS_VISIBLE_ROUTES) {
      expect(paths).toContain(path);
    }
  });
});

describe('atalhos de teclado', () => {
  const paths = ROUTES.map((route) => route.path);

  // Mapeamento anterior à reorganização, recuperado do histórico do Git.
  const LEGACY_SHORTCUTS = [
    '/',
    '/cpu',
    '/cleaner',
    '/rede',
    '/input-lag',
    '/utilities',
    '/privacidade-seguranca',
    '/restore-points',
  ];

  it('preserva Ctrl+1..8 exatamente como antes da reorganizacao', () => {
    expect(PAGE_ROUTES.slice(0, LEGACY_SHORTCUTS.length)).toEqual(LEGACY_SHORTCUTS);
  });

  it('usa o slot livre (Ctrl+9) para a nova pagina Personalizacao', () => {
    expect(getShortcutRoute('9')).toBe('/personalizacao');
    expect(paths).toContain('/personalizacao');
  });

  it('nao tem atalhos duplicados', () => {
    expect(new Set(PAGE_ROUTES).size).toBe(PAGE_ROUTES.length);
  });

  it('so associa rotas que existem em ROUTES', () => {
    for (const path of PAGE_ROUTES) {
      expect(paths, path).toContain(path);
    }
  });

  it('ignora teclas fora de Ctrl+1..9', () => {
    expect(getShortcutRoute('0')).toBeUndefined();
    expect(getShortcutRoute('a')).toBeUndefined();
  });

  it('nao aponta para rotas removidas', () => {
    expect(PAGE_ROUTES).not.toContain('/tweaks');
    expect(PAGE_ROUTES).not.toContain('/apps');
  });
});

describe('paginas oferecidas ao Page Lock', () => {
  it('inclui toda pagina protegida, inclusive a nova Personalizacao', () => {
    const lockable = ROUTES.filter(
      (route) => route.protected && !ALWAYS_VISIBLE_ROUTES.includes(route.path)
    ).map((route) => route.path);
    expect(lockable).toContain('/personalizacao');
    expect(lockable).toContain('/cpu');
    expect(lockable).not.toContain('/');
    expect(lockable).not.toContain('/settings');
  });

  it('nao oferece bloqueio para paginas sem guard', () => {
    // PageLockSection so lista rotas `protected`; oferecer /history ou
    // /restore-points criaria um bloqueio que nunca teria efeito.
    const unprotected = ROUTES.filter((route) => !route.protected).map((route) => route.path);
    expect(unprotected).toContain('/restore-points');
    expect(unprotected).toContain('/history');
    expect(unprotected).toContain('/comparar-placa');
    expect(unprotected).toContain('/overlay-jogo');
  });
});
