import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '../../shared/errors';

describe('toErrorMessage', () => {
  it('devolve a mensagem de um Error', () => {
    expect(toErrorMessage(new Error('falha na leitura'))).toBe('falha na leitura');
  });

  it('devolve strings como estão', () => {
    expect(toErrorMessage('falha crua')).toBe('falha crua');
  });

  it('converte null, undefined e objetos para string', () => {
    expect(toErrorMessage(null)).toBe('null');
    expect(toErrorMessage(undefined)).toBe('undefined');
    expect(toErrorMessage({ code: 1 })).toBe('[object Object]');
  });
});
