import { describe, expect, it } from 'vitest';
import { contrastRatio, hslToRgb, readableForeground, relativeLuminance } from './color-contrast';

const DARK = { r: 10, g: 11, b: 16 };
const WHITE = { r: 255, g: 255, b: 255 };

describe('readableForeground', () => {
  it.each([
    { h: 188, s: 86, l: 53 }, // ciano padrão do app
    { h: 50, s: 100, l: 55 }, // amarelo
    { h: 140, s: 80, l: 55 }, // verde
    { h: 0, s: 100, l: 50 }, // vermelho
    { h: 198, s: 96, l: 38 }, // accent derivado do padrão
  ])('mantém contraste de pelo menos 4,5:1 para %o', (hsl) => {
    const { foreground, background } = readableForeground(hsl);
    const ratio = contrastRatio(hslToRgb(background), foreground === '#ffffff' ? WHITE : DARK);

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('usa texto escuro sobre o ciano padrão em vez de branco', () => {
    expect(readableForeground({ h: 188, s: 86, l: 53 }).foreground).toBe('#0a0b10');
  });

  it('converte HSL conhecido para RGB', () => {
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('mantém a luminância de preto e branco nos extremos', () => {
    expect(relativeLuminance(DARK)).toBeLessThan(0.01);
    expect(relativeLuminance(WHITE)).toBe(1);
  });
});
