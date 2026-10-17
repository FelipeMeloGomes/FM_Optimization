import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExecutionHistoryEntry, ScriptEntry } from '../../electron/shared/ipc-types';
import {
  isCountableScript,
  NON_COUNTABLE_SCRIPT_IDS,
  summarizeAppliedScripts,
} from './applied-scripts';

/**
 * Este teste usa o catálogo real que o app empacota, não uma cópia transcrita à
 * mão: é o que liga a regra do selo/contador aos 104 scripts de verdade. Se
 * alguém marcar um script como interativo ou mexer na lista de exclusões, o
 * número aqui muda e o teste avisa.
 */
const scripts = JSON.parse(
  readFileSync(new URL('../../resources/scripts.json', import.meta.url), 'utf-8')
) as ScriptEntry[];

function entry(scriptId: string): ExecutionHistoryEntry {
  return {
    id: `${scriptId}_2026-01-01T00:00:00.000Z`,
    scriptId,
    scriptName: scriptId,
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    exitCode: 0,
    wasCancelled: false,
  };
}

describe('catálogo real (resources/scripts.json)', () => {
  it('tem 82 ajustes contáveis num catálogo de 104 scripts', () => {
    expect(scripts).toHaveLength(104);
    expect(scripts.filter(isCountableScript)).toHaveLength(82);
  });

  it('nenhum script interativo é contável', () => {
    const interactive = scripts.filter((s) => s.interactive === true);
    expect(interactive.length).toBeGreaterThan(0);
    expect(interactive.filter(isCountableScript)).toEqual([]);
  });

  it('toda exclusão aponta para um script que existe (sem lista fantasma)', () => {
    const ids = new Set(scripts.map((s) => s.id));
    const missing = [...NON_COUNTABLE_SCRIPT_IDS].filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('o rodapé numera o que os selos mostram: Limpeza e Utilitarios contam', () => {
    // builtin-15 (Prioridade CPU/GPU para Jogos) e cleaner-3 (Limpeza de
    // Navegadores) são os dois scripts do histórico de dev do autor — antes o
    // rodapé somava 0 porque as duas categorias ficavam de fora.
    const summary = summarizeAppliedScripts(scripts, [entry('builtin-15'), entry('cleaner-3')]);
    expect(summary).toEqual({ applied: 2, total: 82 });
  });
});
