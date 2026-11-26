import { describe, expect, it, vi } from 'vitest';
import { parsePowerShellJson } from '../utils/powershell-json';

describe('parsePowerShellJson', () => {
  it('devolve o fallback para resposta vazia', () => {
    expect(parsePowerShellJson('  \n ', { label: 'configs', emptyFallback: [] })).toEqual([]);
  });

  it('trata resposta vazia sem fallback como inválida', () => {
    expect(() => parsePowerShellJson(' \n ', { label: 'configurações do mouse' })).toThrow(
      'Não foi possível ler as configurações do mouse: resposta inválida'
    );
  });

  it('faz parse de JSON válido', () => {
    expect(parsePowerShellJson('{"a":1}', { label: 'configs' })).toEqual({ a: 1 });
  });

  it('lança erro com o label quando o JSON é inválido', () => {
    expect(() => parsePowerShellJson('lixo', { label: 'configurações do mouse' })).toThrow(
      'Não foi possível ler as configurações do mouse: resposta inválida'
    );
  });

  it('usa onInvalid para aplicar política própria', () => {
    const onInvalid = vi.fn(() => ['vazio']);

    expect(parsePowerShellJson('lixo', { label: 'gpu', onInvalid })).toEqual(['vazio']);
    expect(onInvalid).toHaveBeenCalledWith('lixo');
  });

  it('encaminha o erro original quando onInvalid lança', () => {
    const onInvalid = vi.fn(() => {
      throw new Error('política própria');
    });

    expect(() => parsePowerShellJson('lixo', { label: 'gpu', onInvalid })).toThrow(
      'política própria'
    );
  });
});
