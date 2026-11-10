import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatMemoryTotal } from './format';

/**
 * Esses helpers alimentam o Dashboard e o Histórico. Um erro de arredondamento
 * aqui não quebra nada, mas mostra ao usuário um número errado — por isso os
 * casos de fronteira (0, 1024, frações) ficam travados.
 */

describe('formatBytes', () => {
  it('trata zero como 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('troca de unidade em potências de 1024', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('mostra uma casa decimal sem zero à direita', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.5 GB');
  });
});

describe('formatDuration', () => {
  it('usa segundos abaixo de um minuto', () => {
    expect(formatDuration(0)).toBe('~0s');
    expect(formatDuration(59)).toBe('~59s');
  });

  it('usa minutos inteiros quando não sobram segundos', () => {
    expect(formatDuration(60)).toBe('~1 min');
    expect(formatDuration(120)).toBe('~2 min');
  });

  it('inclui os segundos restantes', () => {
    expect(formatDuration(125)).toBe('~2 min 5s');
  });
});

describe('formatMemoryTotal', () => {
  it('arredonda o valor e preserva a unidade', () => {
    expect(formatMemoryTotal('32 GB')).toBe('32 GB');
    expect(formatMemoryTotal('31.9 GB')).toBe('32 GB');
  });

  it('aceita vírgula como separador decimal', () => {
    expect(formatMemoryTotal('16,0 GB')).toBe('16 GB');
  });

  it('devolve o texto original quando não reconhece o formato', () => {
    expect(formatMemoryTotal('N/A')).toBe('N/A');
    expect(formatMemoryTotal('sem número')).toBe('sem número');
  });
});
