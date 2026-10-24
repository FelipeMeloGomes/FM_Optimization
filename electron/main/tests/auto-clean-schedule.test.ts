import { describe, expect, it } from 'vitest';
import type { AutoCleanSettings } from '../../shared/ipc-types';
import { computeNextRunAt, parseTime } from '../services/auto-clean-schedule';
import { DEFAULT_AUTO_CLEAN } from '../services/auto-clean-settings';

function settings(overrides: Partial<AutoCleanSettings> = {}): AutoCleanSettings {
  return { ...DEFAULT_AUTO_CLEAN, ...overrides };
}

/** Data local, para não depender do fuso da máquina que roda a suíte. */
function local(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(year, month, day, hours, minutes, 0, 0);
}

describe('parseTime', () => {
  it('lê HH:mm', () => {
    expect(parseTime('07:45')).toEqual({ hours: 7, minutes: 45 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('cai em 03:00 quando o valor é inválido', () => {
    expect(parseTime('')).toEqual({ hours: 3, minutes: 0 });
    expect(parseTime('25:99')).toEqual({ hours: 23, minutes: 59 });
    expect(parseTime('abc')).toEqual({ hours: 3, minutes: 0 });
  });
});

describe('computeNextRunAt', () => {
  it('diária: usa o horário de hoje quando ainda não passou', () => {
    const from = local(2026, 0, 10, 2, 0);
    const next = computeNextRunAt(settings({ frequency: 'daily', time: '03:00' }), from.getTime());
    expect(next).toBe(local(2026, 0, 10, 3, 0).getTime());
  });

  it('diária: rola para amanhã quando o horário já passou', () => {
    const from = local(2026, 0, 10, 4, 0);
    const next = computeNextRunAt(settings({ frequency: 'daily', time: '03:00' }), from.getTime());
    expect(next).toBe(local(2026, 0, 11, 3, 0).getTime());
  });

  it('diária: horário exato conta como já passado', () => {
    const from = local(2026, 0, 10, 3, 0);
    const next = computeNextRunAt(settings({ frequency: 'daily', time: '03:00' }), from.getTime());
    expect(next).toBe(local(2026, 0, 11, 3, 0).getTime());
  });

  it('semanal: escolhe o próximo dia da semana pedido', () => {
    // 05/01/2026 é uma segunda-feira; 07/01 é quarta.
    const from = local(2026, 0, 5, 2, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'weekly', weekday: 3, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2026, 0, 7, 3, 0).getTime());
  });

  it('semanal: quando o horário do próprio dia já passou, vai para a semana seguinte', () => {
    const from = local(2026, 0, 7, 4, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'weekly', weekday: 3, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2026, 0, 14, 3, 0).getTime());
  });

  it('mensal: usa o dia deste mês quando ainda está à frente', () => {
    const from = local(2026, 0, 15, 2, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'monthly', dayOfMonth: 20, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2026, 0, 20, 3, 0).getTime());
  });

  it('mensal: rola para o mês seguinte quando o dia já passou', () => {
    const from = local(2026, 0, 15, 2, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'monthly', dayOfMonth: 1, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2026, 1, 1, 3, 0).getTime());
  });

  it('mensal: atravessa a virada do ano', () => {
    const from = local(2026, 11, 20, 2, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'monthly', dayOfMonth: 1, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2027, 0, 1, 3, 0).getTime());
  });

  it('mensal: nunca agenda dia 29-31, que não existe em todo mês', () => {
    const from = local(2026, 3, 30, 2, 0);
    const next = computeNextRunAt(
      settings({ frequency: 'monthly', dayOfMonth: 31, time: '03:00' }),
      from.getTime()
    );
    expect(next).toBe(local(2026, 4, 28, 3, 0).getTime());
  });
});
