import { describe, expect, it } from 'vitest';
import { getShortcutRoute, PAGE_ROUTES } from '../hooks/use-keyboard-shortcuts';
import { CATEGORY_ROUTES } from '../lib/category-routes';
import { ALWAYS_VISIBLE_ROUTES } from '../lib/page-lock';
import { ROUTES, routesByCategory } from './config';

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

  it('rotula /cpu como Desempenho sem mudar a rota', () => {
    // A rota fica estavel para Page Lock e links antigos; so o rotulo muda.
    const route = ROUTES.find((r) => r.path === '/cpu');
    expect(route?.label).toBe('Desempenho');
    expect(route?.category).toBe('desempenho');
  });

  it('inclui Personalizacao como pagina propria e protegida', () => {
    const route = ROUTES.find((r) => r.path === '/personalizacao');
    expect(route?.label).toBe('Personalização');
    expect(route?.category).toBe('manutencao');
    expect(route?.protected).toBe(true);
  });

  it('nao tem mais /tweaks nem /apps', () => {
    expect(paths).not.toContain('/tweaks');
    expect(paths).not.toContain('/apps');
  });

  it('coloca Restauracao e Historico em Sistema, nao em Seguranca', () => {
    expect(routesByCategory('seguranca').map((r) => r.path)).toEqual(['/privacidade-seguranca']);
    expect(routesByCategory('sistema').map((r) => r.path)).toContain('/restore-points');
    expect(routesByCategory('sistema').map((r) => r.path)).toContain('/history');
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
  });
});
