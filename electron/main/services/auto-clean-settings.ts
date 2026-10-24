import type { AutoCleanSettings } from '../../shared/ipc-types';

export const DEFAULT_AUTO_CLEAN: AutoCleanSettings = {
  enabled: false,
  cleaners: ['cleaner-1', 'cleaner-2', 'cleaner-3', 'cleaner-4'],
  frequency: 'weekly',
  weekday: 0,
  dayOfMonth: 1,
  time: '03:00',
  runOnStartup: false,
  catchUp: true,
  lastRunAt: null,
  nextRunAt: null,
  pending: [],
};

const CLEANER_ID_RE = /^cleaner-\d+$/;
const TIME_RE = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

export function parseCleanerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is string => typeof id === 'string' && CLEANER_ID_RE.test(id));
  return [...new Set(ids)].slice(0, 4);
}

/** Cópia dos defaults: arrays compartilhados vazariam entre leituras. */
function cloneDefaults(): AutoCleanSettings {
  return { ...DEFAULT_AUTO_CLEAN, cleaners: [...DEFAULT_AUTO_CLEAN.cleaners], pending: [] };
}

/** Leitura tolerante: campo inválido cai no default em vez de derrubar o arquivo. */
export function parseAutoClean(raw: unknown): AutoCleanSettings {
  if (!raw || typeof raw !== 'object') return cloneDefaults();
  const value = raw as Record<string, unknown>;

  const frequency =
    value.frequency === 'daily' || value.frequency === 'weekly' || value.frequency === 'monthly'
      ? value.frequency
      : DEFAULT_AUTO_CLEAN.frequency;

  const weekday =
    typeof value.weekday === 'number' &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6
      ? value.weekday
      : null;

  const dayOfMonth =
    typeof value.dayOfMonth === 'number' &&
    Number.isInteger(value.dayOfMonth) &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 28
      ? value.dayOfMonth
      : null;

  const cleaners = parseCleanerIds(value.cleaners);

  return {
    enabled: value.enabled === true,
    cleaners: cleaners.length > 0 ? cleaners : [...DEFAULT_AUTO_CLEAN.cleaners],
    frequency,
    weekday: frequency === 'weekly' ? (weekday ?? DEFAULT_AUTO_CLEAN.weekday) : weekday,
    dayOfMonth:
      frequency === 'monthly' ? (dayOfMonth ?? DEFAULT_AUTO_CLEAN.dayOfMonth) : dayOfMonth,
    time:
      typeof value.time === 'string' && TIME_RE.test(value.time)
        ? value.time
        : DEFAULT_AUTO_CLEAN.time,
    runOnStartup: value.runOnStartup === true,
    catchUp: value.catchUp !== false,
    lastRunAt: typeof value.lastRunAt === 'number' ? value.lastRunAt : null,
    nextRunAt: typeof value.nextRunAt === 'number' ? value.nextRunAt : null,
    pending: parseCleanerIds(value.pending),
  };
}
