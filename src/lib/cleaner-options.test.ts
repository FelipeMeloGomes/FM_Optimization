import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLEANER_OPTIONS, cleanerName, formatNextRun } from './cleaner-options';

/**
 * `formatNextRun` decide o texto do próximo agendamento mostrado ao usuário.
 * A lógica de "hoje/amanhã/dia da semana/data" depende do relógio local, então
 * os testes fixam a data e cobrem cada ramo.
 */

describe('CLEANER_OPTIONS', () => {
  it('cobre os quatro scripts de limpeza do catálogo', () => {
    expect(CLEANER_OPTIONS.map((option) => option.id)).toEqual([
      'cleaner-1',
      'cleaner-2',
      'cleaner-3',
      'cleaner-4',
    ]);
  });

  it('só a limpeza de navegadores dispensa admin', () => {
    const withoutAdmin = CLEANER_OPTIONS.filter((option) => !option.requiresAdmin);

    expect(withoutAdmin.map((option) => option.id)).toEqual(['cleaner-3']);
  });
});

describe('cleanerName', () => {
  it('devolve o nome do catálogo', () => {
    expect(cleanerName('cleaner-1')).toBe('Limpeza Rápida');
  });

  it('devolve o id quando não reconhece', () => {
    expect(cleanerName('cleaner-99')).toBe('cleaner-99');
  });
});

describe('formatNextRun', () => {
  // Segunda-feira, 5 de janeiro de 2026, 10:00 local.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('diz "hoje" para o mesmo dia', () => {
    expect(formatNextRun(new Date(2026, 0, 5, 14, 30).getTime())).toBe('hoje às 14:30');
  });

  it('diz "amanhã" para o dia seguinte', () => {
    expect(formatNextRun(new Date(2026, 0, 6, 9, 5).getTime())).toBe('amanhã às 09:05');
  });

  it('usa o nome do dia da semana dentro da semana', () => {
    // Quinta-feira, 8 de janeiro.
    expect(formatNextRun(new Date(2026, 0, 8, 18, 0).getTime())).toBe('quinta-feira, 18:00');
  });

  it('usa dd/MM para datas mais distantes', () => {
    expect(formatNextRun(new Date(2026, 0, 20, 7, 15).getTime())).toBe('20/01 às 07:15');
  });

  it('trata uma data no passado como data absoluta', () => {
    // diffDays negativo não entra no ramo do dia da semana.
    expect(formatNextRun(new Date(2026, 0, 1, 8, 0).getTime())).toBe('01/01 às 08:00');
  });

  it('preenche hora e minuto com zero à esquerda', () => {
    expect(formatNextRun(new Date(2026, 0, 5, 6, 7).getTime())).toBe('hoje às 06:07');
  });
});
