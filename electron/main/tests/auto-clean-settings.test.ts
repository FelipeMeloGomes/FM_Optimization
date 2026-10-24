import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTO_CLEAN,
  parseAutoClean,
  parseCleanerIds,
} from '../services/auto-clean-settings';

describe('parseCleanerIds', () => {
  it('mantém apenas ids de limpeza válidos e remove duplicatas', () => {
    expect(parseCleanerIds(['cleaner-1', 'cleaner-1', 'cleaner-3', 'tweaks-2', 42])).toEqual([
      'cleaner-1',
      'cleaner-3',
    ]);
  });

  it('devolve lista vazia para entrada que não é array', () => {
    expect(parseCleanerIds(undefined)).toEqual([]);
    expect(parseCleanerIds('cleaner-1')).toEqual([]);
  });

  it('limita a quatro ids', () => {
    expect(
      parseCleanerIds(['cleaner-1', 'cleaner-2', 'cleaner-3', 'cleaner-4', 'cleaner-5'])
    ).toHaveLength(4);
  });
});

describe('parseAutoClean', () => {
  it('cai nos defaults quando o valor não é objeto', () => {
    expect(parseAutoClean(undefined)).toEqual(DEFAULT_AUTO_CLEAN);
    expect(parseAutoClean(null)).toEqual(DEFAULT_AUTO_CLEAN);
    expect(parseAutoClean('lixo')).toEqual(DEFAULT_AUTO_CLEAN);
  });

  it('cai nos defaults nos campos inválidos, sem descartar os válidos', () => {
    const parsed = parseAutoClean({
      enabled: true,
      cleaners: ['cleaner-3'],
      frequency: 'hourly',
      time: '99:99',
      pending: ['cleaner-2', 'not-a-cleaner'],
    });

    expect(parsed.enabled).toBe(true);
    expect(parsed.cleaners).toEqual(['cleaner-3']);
    expect(parsed.frequency).toBe(DEFAULT_AUTO_CLEAN.frequency);
    expect(parsed.time).toBe(DEFAULT_AUTO_CLEAN.time);
    expect(parsed.pending).toEqual(['cleaner-2']);
  });

  it('preserva uma configuração válida', () => {
    const parsed = parseAutoClean({
      enabled: true,
      cleaners: ['cleaner-1', 'cleaner-4'],
      frequency: 'monthly',
      dayOfMonth: 10,
      time: '22:30',
      runOnStartup: true,
      catchUp: false,
      lastRunAt: 1_700_000_000_000,
      nextRunAt: 1_700_000_100_000,
      pending: ['cleaner-2'],
    });

    expect(parsed).toEqual({
      enabled: true,
      cleaners: ['cleaner-1', 'cleaner-4'],
      frequency: 'monthly',
      weekday: null,
      dayOfMonth: 10,
      time: '22:30',
      runOnStartup: true,
      catchUp: false,
      lastRunAt: 1_700_000_000_000,
      nextRunAt: 1_700_000_100_000,
      pending: ['cleaner-2'],
    });
  });

  it('completa o dia da semana quando a frequência é semanal', () => {
    const parsed = parseAutoClean({ frequency: 'weekly' });
    expect(parsed.weekday).toBe(DEFAULT_AUTO_CLEAN.weekday);
  });

  it('nunca deixa a seleção de limpezas vazia', () => {
    const parsed = parseAutoClean({ cleaners: [] });
    expect(parsed.cleaners).toEqual(DEFAULT_AUTO_CLEAN.cleaners);
  });

  it('catchUp só desliga quando explicitamente false', () => {
    expect(parseAutoClean({}).catchUp).toBe(true);
    expect(parseAutoClean({ catchUp: 'não' }).catchUp).toBe(true);
    expect(parseAutoClean({ catchUp: false }).catchUp).toBe(false);
  });
});
