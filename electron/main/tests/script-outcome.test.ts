import { describe, expect, it } from 'vitest';
import {
  createHistoryEntry,
  EXIT_MENU_CLOSED_WITHOUT_APPLY,
  EXIT_UNKNOWN_HANDOFF,
  normalizeInteractiveExitCode,
} from '../services/script-outcome';

describe('createHistoryEntry', () => {
  it('monta a entrada com id estavel e duracao', () => {
    expect(createHistoryEntry('apps-6', 'Spotify', 1000, 3500, 0, false, 'manual')).toEqual({
      id: 'apps-6_1000',
      scriptId: 'apps-6',
      scriptName: 'Spotify',
      startTime: new Date(1000).toISOString(),
      endTime: new Date(3500).toISOString(),
      durationMs: 2500,
      exitCode: 0,
      wasCancelled: false,
      trigger: 'manual',
    });
  });
});

describe('normalizeInteractiveExitCode', () => {
  it('trata o sentinela de handoff desconhecido como resultado desconhecido', () => {
    for (const id of ['apps-6', 'apps-7']) {
      expect(normalizeInteractiveExitCode(id, EXIT_UNKNOWN_HANDOFF)).toBeNull();
    }
  });

  it('trata o sentinela de menu fechado sem aplicar como desconhecido', () => {
    for (const id of ['tweaks-5', 'apps-2', 'builtin-13']) {
      expect(normalizeInteractiveExitCode(id, EXIT_MENU_CLOSED_WITHOUT_APPLY)).toBeNull();
    }
  });

  it('nao apaga codigos reais de outros scripts', () => {
    expect(normalizeInteractiveExitCode('apps-2', EXIT_UNKNOWN_HANDOFF)).toBe(2);
    expect(normalizeInteractiveExitCode('apps-6', EXIT_MENU_CLOSED_WITHOUT_APPLY)).toBe(3);
    expect(normalizeInteractiveExitCode('dns-1', 0)).toBe(0);
    expect(normalizeInteractiveExitCode('apps-4', 1)).toBe(1);
    expect(normalizeInteractiveExitCode('apps-4', null)).toBeNull();
  });

  it('nao confunde sucesso com os sentinelas', () => {
    expect(normalizeInteractiveExitCode('apps-6', 0)).toBe(0);
    expect(normalizeInteractiveExitCode('builtin-13', 0)).toBe(0);
  });
});
