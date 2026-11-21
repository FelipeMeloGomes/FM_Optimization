// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ROUTES } from './config';
import { getRouteIcon, ROUTE_ICONS } from './route-icons';

/**
 * A sidebar e os heroes não podem escolher ícones separadamente: o mapa de
 * rotas é a única fonte de verdade. Qualquer rota sem ícone — ou ícone sem rota —
 * quebra a consistência automática.
 */
describe('ROUTE_ICONS — fonte única dos ícones da sidebar', () => {
  it('devolve para cada rota exatamente o ícone usado pela sidebar', () => {
    for (const route of ROUTES) {
      expect(getRouteIcon(route.path), route.path).toBe(route.icon);
    }
  });

  it('não deixa ícone órfão no mapa', () => {
    const paths = new Set(ROUTES.map((route) => route.path));

    expect(Object.keys(ROUTE_ICONS).sort()).toEqual([...paths].sort());
  });
});
