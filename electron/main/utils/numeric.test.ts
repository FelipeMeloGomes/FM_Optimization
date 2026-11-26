import { describe, expect, it } from 'vitest';
import { isInRange, isIntegerInRange } from './numeric';

describe('isIntegerInRange', () => {
  it('aceita inteiros nos limites inclusivos e no interior do intervalo', () => {
    expect(isIntegerInRange(1, 1, 20)).toBe(true);
    expect(isIntegerInRange(10, 1, 20)).toBe(true);
    expect(isIntegerInRange(20, 1, 20)).toBe(true);
  });

  it('rejeita valores fora do intervalo e limites invertidos', () => {
    expect(isIntegerInRange(0, 1, 20)).toBe(false);
    expect(isIntegerInRange(21, 1, 20)).toBe(false);
    expect(isIntegerInRange(5, 20, 1)).toBe(false);
  });

  it('rejeita não inteiros e valores que não são números', () => {
    expect(isIntegerInRange(1.5, 1, 20)).toBe(false);
    expect(isIntegerInRange(Number.NaN, 1, 20)).toBe(false);
    expect(isIntegerInRange(Number.POSITIVE_INFINITY, 1, 20)).toBe(false);
    expect(isIntegerInRange(Number.NEGATIVE_INFINITY, 1, 20)).toBe(false);
    expect(isIntegerInRange('10', 1, 20)).toBe(false);
    expect(isIntegerInRange(null, 1, 20)).toBe(false);
    expect(isIntegerInRange(undefined, 1, 20)).toBe(false);
    expect(isIntegerInRange(true, 1, 20)).toBe(false);
  });

  it('aceita limites negativos e estreita unknown para number', () => {
    expect(isIntegerInRange(-5, -10, -1)).toBe(true);
    expect(isIntegerInRange(0, -10, -1)).toBe(false);

    const value: unknown = 7;
    if (isIntegerInRange(value, 1, 10)) {
      const doubled: number = value * 2;
      expect(doubled).toBe(14);
    } else {
      throw new Error('o type guard deveria aceitar 7');
    }
  });
});

describe('isInRange', () => {
  it('aceita números não inteiros nos limites inclusivos', () => {
    expect(isInRange(0, 0, 60)).toBe(true);
    expect(isInRange(30.5, 0, 60)).toBe(true);
    expect(isInRange(60, 0, 60)).toBe(true);
  });

  it('rejeita valores fora do intervalo, NaN e limites invertidos', () => {
    expect(isInRange(-0.1, 0, 60)).toBe(false);
    expect(isInRange(60.1, 0, 60)).toBe(false);
    expect(isInRange(Number.NaN, 0, 60)).toBe(false);
    expect(isInRange(5, 60, 0)).toBe(false);
  });
});
