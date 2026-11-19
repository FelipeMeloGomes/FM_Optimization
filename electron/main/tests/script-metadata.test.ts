import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * Metadados que prometiam mais do que o script faz. O catálogo é a fonte real,
 * então estes testes leem o `resources/scripts.json` publicado.
 */
const SCRIPTS_PATH = resolve(cwd(), 'resources/scripts.json');

interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  guide: string;
  riskLevel?: 'safe' | 'moderate' | 'deep';
}

const scripts: ScriptEntry[] = JSON.parse(readFileSync(SCRIPTS_PATH, 'utf-8'));

function find(id: string): ScriptEntry {
  const script = scripts.find((s) => s.id === id);
  if (!script) throw new Error(`Script ${id} not found`);
  return script;
}

describe('familia do svchost — sem promessa de liberar RAM', () => {
  const family = ['cpu-30', 'cpu-31', 'cpu-32', 'cpu-33', 'cpu-34', 'cpu-35', 'cpu-36', 'cpu-37'];

  it.each(family)('%s nao promete liberar nem resetar RAM', (id) => {
    const script = find(id);
    expect(script.name).not.toMatch(/liberar RAM|resetar RAM/i);
    expect(script.description).toMatch(/n[ãa]o libera mem[óo]ria/i);
  });

  it.each(family)('%s cita a chave que realmente altera', (id) => {
    expect(find(id).description).toContain('SvcHostSplitThresholdInKB');
  });

  it.each(family)('%s deixa claro o que o ajuste faz com os servicos', (id) => {
    expect(find(id).description).toMatch(/svchost/i);
  });
});
