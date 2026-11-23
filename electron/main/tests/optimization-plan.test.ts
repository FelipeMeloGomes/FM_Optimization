import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../shared/ipc-types';
import { checkId, parseChecks } from '../services/optimization-checks';
import { OPTIMIZATION_PLAN, resolvePlan } from '../services/optimization-plan';

const scripts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'resources/scripts.json'), 'utf-8')
) as ScriptEntry[];

describe('plano curado de otimização', () => {
  it('tem 16 tweaks e todos existem no scripts.json real', () => {
    expect(OPTIMIZATION_PLAN).toHaveLength(16);
    const plan = resolvePlan(scripts);
    expect(plan).toHaveLength(16);
    expect(plan.every((entry) => entry.script.name.length > 0)).toBe(true);
  });

  it('não inclui scripts interativos, de ação ou de reversão', () => {
    const ids = new Set(OPTIMIZATION_PLAN.map((entry) => entry.id));
    const proibidos = [
      'tweaks-5',
      'apps-2',
      'apps-4',
      'apps-5',
      'apps-6',
      'apps-7',
      'internet-11',
      'builtin-6',
      'builtin-7',
      'builtin-86',
      'cpu-37',
      'inputlag-4',
      'inputlag-7',
      'cpu-18',
      'cpu-21',
      'internet-1',
      'internet-5',
    ];
    for (const id of proibidos) expect(ids.has(id)).toBe(false);

    const plan = resolvePlan(scripts);
    expect(plan.some((entry) => entry.script.interactive === true)).toBe(false);
  });

  it('todo tweak do plano tem pelo menos uma verificação derivada do script real', () => {
    for (const entry of resolvePlan(scripts)) {
      expect(parseChecks(entry.script).length, entry.id).toBeGreaterThan(0);
    }
  });

  it('nenhum par de tweaks escreve a mesma chave com valores diferentes', () => {
    const escritores = new Map<string, { id: string; expected: string }>();

    for (const entry of resolvePlan(scripts)) {
      for (const check of parseChecks(entry.script)) {
        const id = checkId(check);
        const anterior = escritores.get(id);
        if (anterior && anterior.expected !== check.expected) {
          throw new Error(
            `Conflito no plano: ${anterior.id} espera ${anterior.expected} e ${entry.id} espera ${check.expected} em ${id}`
          );
        }
        escritores.set(id, { id: entry.id, expected: check.expected });
      }
    }

    expect(escritores.size).toBeGreaterThan(20);
  });

  it('falha alto se um ID do catálogo desaparecer', () => {
    expect(() => resolvePlan(scripts.filter((script) => script.id !== 'tweaks-1'))).toThrow(
      /tweaks-1/
    );
  });
});
