import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatElapsedMs,
  formatMemoryTotal,
  formatUptimeCompact,
  formatUptimeLong,
  plural,
} from './format';

process.env.TZ = 'UTC';

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

describe('formatDateTime', () => {
  it('formata string, timestamp e Date em pt-BR', () => {
    const expected = '02/01/2026, 03:04:05';
    expect(formatDateTime('2026-01-02T03:04:05.000Z')).toBe(expected);
    expect(formatDateTime(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe(expected);
    expect(formatDateTime(new Date('2026-01-02T03:04:05.000Z'))).toBe(expected);
  });
});

describe('plural', () => {
  it('usa o singular apenas para um', () => {
    expect(plural(0, 'resultado', 'resultados')).toBe('0 resultados');
    expect(plural(1, 'resultado', 'resultados')).toBe('1 resultado');
    expect(plural(2, 'resultado', 'resultados')).toBe('2 resultados');
  });
});

describe('formatUptimeCompact', () => {
  it('mostra apenas minutos abaixo de uma hora', () => {
    expect(formatUptimeCompact(0)).toBe('0m');
    expect(formatUptimeCompact(90)).toBe('1m');
  });

  it('inclui horas e dias quando presentes', () => {
    expect(formatUptimeCompact(3661)).toBe('1h 1m');
    expect(formatUptimeCompact(90061)).toBe('1d 1h 1m');
  });
});

describe('formatUptimeLong', () => {
  it('filtra as partes zeradas', () => {
    expect(formatUptimeLong(0)).toBe('0 s');
    expect(formatUptimeLong(3600)).toBe('1 h');
  });

  it('mantém dias, horas, minutos e segundos', () => {
    expect(formatUptimeLong(90061)).toBe('1 d 1 h 1 min 1 s');
  });
});

describe('formatElapsedMs', () => {
  it('usa milissegundos abaixo de um segundo', () => {
    expect(formatElapsedMs(0)).toBe('0ms');
    expect(formatElapsedMs(999)).toBe('999ms');
  });

  it('usa segundos inteiros abaixo de um minuto', () => {
    expect(formatElapsedMs(1000)).toBe('1s');
    expect(formatElapsedMs(1500)).toBe('1s');
  });

  it('usa minutos com os segundos restantes', () => {
    expect(formatElapsedMs(60000)).toBe('1m 0s');
    expect(formatElapsedMs(90061)).toBe('1m 30s');
  });
});
