/** Aceita apenas inteiros dentro do intervalo, inclusive nos limites. */
export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Aceita qualquer número dentro do intervalo, inclusive nos limites. */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
