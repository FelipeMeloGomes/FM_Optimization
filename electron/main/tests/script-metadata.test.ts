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

function textOf(id: string): string {
  const script = find(id);
  return `${script.name} ${script.description} ${script.guide}`;
}

describe('cpu-1 e cpu-2 — risco profundo e aviso no texto', () => {
  it.each(['cpu-1', 'cpu-2'])('%s esta marcado como deep', (id) => {
    expect(find(id).riskLevel).toBe('deep');
  });

  it('cpu-1 avisa sobre o hypervisor e o reinicio', () => {
    const text = textOf('cpu-1');
    expect(text).toMatch(/hipervisor|hyper-v/i);
    expect(text).toMatch(/reinici/i);
  });

  it('cpu-2 avisa que apaga arquivos e pede backup', () => {
    const text = textOf('cpu-2');
    expect(text).toMatch(/backup|ponto de restaura/i);
    expect(text).toMatch(/apaga|remove/i);
  });
});

describe('cpu-17 — nome nao promete ativar nucleos', () => {
  it('nao comeca com "Ativar"', () => {
    expect(find('cpu-17').name).not.toMatch(/^ativar/i);
  });

  it('continua identificavel como configuracao de nucleos', () => {
    expect(find('cpu-17').name).toMatch(/n[úu]cleo/i);
  });

  it('diz explicitamente que nao ativa nucleos', () => {
    expect(textOf('cpu-17')).toMatch(/n[ãa]o (?:ativa|altera)/i);
  });
});

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
