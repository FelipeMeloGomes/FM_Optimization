import type { AutoCleanSettings } from '../../shared/ipc-types';

const FALLBACK_TIME = '03:00';

function atTime(base: Date, hours: number, minutes: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 0, 0, 0, 0);
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    const [h, m] = FALLBACK_TIME.split(':').map(Number);
    return { hours: h, minutes: m };
  }
  return {
    hours: Math.min(23, Math.max(0, Number.parseInt(match[1], 10))),
    minutes: Math.min(59, Math.max(0, Number.parseInt(match[2], 10))),
  };
}

/**
 * Próxima execução a partir de `from`. Puro e sem electron para poder ser
 * testado: diária, semanal (weekday 0-6) e mensal (dia 1..28 — nunca 29-31, que
 * não existem em todo mês).
 */
export function computeNextRunAt(settings: AutoCleanSettings, from: number): number {
  const { hours, minutes } = parseTime(settings.time);
  const fromDate = new Date(from);

  if (settings.frequency === 'weekly' && settings.weekday !== null) {
    const target = ((settings.weekday % 7) + 7) % 7;
    const delta = (target - fromDate.getDay() + 7) % 7;
    let candidate = atTime(addDays(fromDate, delta), hours, minutes);
    if (candidate.getTime() <= from) candidate = atTime(addDays(candidate, 7), hours, minutes);
    return candidate.getTime();
  }

  if (settings.frequency === 'monthly' && settings.dayOfMonth !== null) {
    const day = Math.min(28, Math.max(1, settings.dayOfMonth));
    let candidate = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      day,
      hours,
      minutes,
      0,
      0
    );
    if (candidate.getTime() <= from) {
      candidate = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth() + 1,
        day,
        hours,
        minutes,
        0,
        0
      );
    }
    return candidate.getTime();
  }

  let candidate = atTime(fromDate, hours, minutes);
  if (candidate.getTime() <= from) candidate = atTime(addDays(fromDate, 1), hours, minutes);
  return candidate.getTime();
}
