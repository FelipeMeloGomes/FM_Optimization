import { describe, expect, it } from 'vitest';
import { BLOATWARE_PACKAGES, PRESETS } from './bloatware';

/**
 * Os presets são cumulativos: escolher "Máximo" precisa remover tudo que
 * "Leve" e "Recomendado" removem. Se alguém editar uma lista e esquecer de
 * propagar, o preset maior passa a remover menos que o menor — e o usuário não
 * percebe até o Debloat rodar.
 */

const KEYS = ['leve', 'recomendado', 'maximo'] as const;

describe('presets de bloatware', () => {
  it('cada preset é um superconjunto do anterior', () => {
    for (const pkg of PRESETS.leve.packages) {
      expect(PRESETS.recomendado.packages).toContain(pkg);
    }
    for (const pkg of PRESETS.recomendado.packages) {
      expect(PRESETS.maximo.packages).toContain(pkg);
    }
  });

  it('não repete pacote dentro do mesmo preset', () => {
    for (const key of KEYS) {
      const packages = PRESETS[key].packages;
      expect(new Set(packages).size, key).toBe(packages.length);
    }
  });

  it('mantém a ordem do menor para o maior', () => {
    expect(PRESETS.leve.packages.length).toBeLessThan(PRESETS.recomendado.packages.length);
    expect(PRESETS.recomendado.packages.length).toBeLessThan(PRESETS.maximo.packages.length);
  });

  it('o conjunto agregado é exatamente a união dos presets', () => {
    const union = new Set<string>();
    for (const key of KEYS) {
      for (const pkg of PRESETS[key].packages) union.add(pkg);
    }

    expect(BLOATWARE_PACKAGES).toEqual(union);
  });
});
