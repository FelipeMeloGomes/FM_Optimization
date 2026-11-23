import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../shared/ipc-types';
import {
  checkId,
  decodeScript,
  normalizeValue,
  parseChecks,
} from '../services/optimization-checks';

const scripts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'resources/scripts.json'), 'utf-8')
) as ScriptEntry[];

function script(id: string): ScriptEntry {
  const found = scripts.find((entry) => entry.id === id);
  if (!found) throw new Error(`Script de teste não encontrado: ${id}`);
  return found;
}

function checkFor(id: string, idDaChecagem: string) {
  const check = parseChecks(script(id)).find((item) => checkId(item) === idDaChecagem);
  if (!check) throw new Error(`Checagem não encontrada: ${idDaChecagem} em ${id}`);
  return check;
}

describe('derivação de verificações a partir dos scripts reais', () => {
  it('lê reg add comuns nos arquivos .bat', () => {
    expect(
      checkFor(
        'tweaks-1',
        'registry:hkcu\\software\\microsoft\\windows\\currentversion\\search|searchboxtaskbarmode'
      )
    ).toMatchObject({
      kind: 'registry',
      type: 'REG_DWORD',
      expected: '0',
    });
  });

  it('lê arquivos .reg com valor dword', () => {
    expect(
      checkFor('cpu-30', 'registry:hklm\\system\\controlset001\\control|svchostsplitthresholdinkb')
    ).toMatchObject({ kind: 'registry', type: 'REG_DWORD', expected: '4194304' });
  });

  it('junta linhas continuadas de valores hex', () => {
    const check = parseChecks(script('cpu-16')).find((item) =>
      checkId(item).includes('win32_autogamemodedefaultprofile')
    );
    if (check?.kind !== 'registry') throw new Error('esperado registry');
    expect(check.type).toBe('REG_BINARY');
    expect(check.expected.startsWith('01000100')).toBe(true);
    expect(check.expected).not.toContain('\\');
    expect(check.expected).not.toContain(',');
  });

  it('lê netsh set global e normaliza aliases', () => {
    expect(checkFor('builtin-18', 'tcp:rsc')).toMatchObject({ kind: 'tcp', expected: 'disabled' });
    expect(checkFor('builtin-18', 'tcp:dca')).toMatchObject({ kind: 'tcp', expected: 'enabled' });
    expect(checkFor('builtin-18', 'tcp:ecncapability')).toMatchObject({
      kind: 'tcp',
      expected: 'enabled',
    });
  });

  it('lê powercfg de energia, suspensão e hibernate', () => {
    expect(checkFor('tweaks-3', 'power:cpmincores')).toMatchObject({
      kind: 'power',
      expected: '1',
    });
    expect(checkFor('tweaks-3', 'power:aspm')).toMatchObject({ kind: 'power', expected: '0' });
    expect(checkFor('tweaks-3', 'power:standby-ac')).toMatchObject({
      kind: 'power',
      expected: '0',
    });
    expect(
      checkFor(
        'tweaks-3',
        'registry:hklm\\system\\currentcontrolset\\control\\power|hibernateenabled'
      )
    ).toMatchObject({ kind: 'registry', expected: '0' });
  });

  it('remove checagens repetidas, mantendo o último valor', () => {
    const afd = parseChecks(script('internet-4'));
    const ids = afd.map(checkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não inventa verificações para scripts de ação', () => {
    expect(parseChecks(script('cleaner-1'))).toHaveLength(0);
  });
});

describe('normalização de valores', () => {
  it('converte dword hexadecimal e decimal para a mesma base', () => {
    expect(normalizeValue('REG_DWORD', '0x0')).toBe('0');
    expect(normalizeValue('REG_DWORD', '00000000')).toBe('0');
    expect(normalizeValue('REG_DWORD', '4194304')).toBe('4194304');
  });

  it('normaliza binário e string', () => {
    expect(normalizeValue('REG_BINARY', '90 32 07 80')).toBe('90320780');
    expect(normalizeValue('REG_SZ', '"No"')).toBe('no');
  });

  it('decodifica o conteúdo base64 do catálogo', () => {
    expect(decodeScript(script('internet-1'))).toContain('netsh int tcp set global');
  });
});
