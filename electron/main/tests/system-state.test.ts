import { describe, expect, it, vi } from 'vitest';
import type { PowerSetting, RegistryCheck } from '../services/optimization-checks';
import {
  createSystemStateReader,
  type ExecFileFn,
  parsePowerQuery,
  parseRegistryQuery,
  parseTcpGlobal,
  powerCheckValue,
  registryCheckValue,
  tcpCheckValue,
} from '../services/system-state';

const registryCheck: RegistryCheck = {
  kind: 'registry',
  key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search',
  value: 'searchboxtaskbarmode',
  type: 'REG_DWORD',
  expected: '0',
};

describe('parsers de estado do Windows', () => {
  it('lê valores de reg query ignorando o cabeçalho da chave', () => {
    const output = [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Search',
      '    SearchboxTaskbarMode    REG_DWORD    0x0',
      '    SearchOnTaskbarMode    REG_DWORD    0x2',
    ].join('\n');

    expect(parseRegistryQuery(output, registryCheck.key).get('searchboxtaskbarmode')).toBe('0');
    const byCheckId = new Map([
      [
        'registry:hkcu\\software\\microsoft\\windows\\currentversion\\search|searchboxtaskbarmode',
        '0',
      ],
    ]);
    expect(registryCheckValue(registryCheck, byCheckId)).toBe('0');
  });

  it('marca valores ausentes como null', () => {
    expect(registryCheckValue(registryCheck, new Map())).toBeNull();
  });

  it('lê a saída do netsh usando os rótulos do Windows', () => {
    const output = [
      'Receive-Side Scaling State          : enabled',
      'Receive Segment Coalescing State     : disabled',
      'Direct Cache Acess (DCA)             : enable',
      'Receive Window Auto-Tuning Level    : normal',
    ].join('\n');

    const parsed = parseTcpGlobal(output);
    expect(parsed.get('receive-side scaling state')).toBe('enabled');
    expect(parsed.get('direct cache acess (dca)')).toBe('enabled');
  });

  it('lê os índices AC e DC do powercfg', () => {
    const output = [
      '  Current AC Power Setting Index: 0x00000000',
      '  Current DC Power Setting Index: 0x00000001',
    ].join('\n');
    expect(parsePowerQuery(output).get('ac')).toBe('0');
    expect(parsePowerQuery(output).get('dc')).toBe('1');
  });
});

describe('SystemStateReader', () => {
  it('executa as consultas reais e devolve os valores normalizados', async () => {
    const calls: string[] = [];
    const exec: ExecFileFn = vi.fn(async (file, args) => {
      calls.push(`${file} ${args.join(' ')}`);
      if (file === 'reg.exe') {
        return {
          stdout: '    SearchboxTaskbarMode    REG_DWORD    0x0',
          stderr: '',
        };
      }
      if (file === 'netsh.exe') {
        return {
          stdout: 'Receive Segment Coalescing State     : disabled',
          stderr: '',
        };
      }
      return {
        stdout: '  Current AC Power Setting Index: 0x00000001',
        stderr: '',
      };
    });

    const reader = createSystemStateReader(exec);
    const [registry, tcp, power] = await Promise.all([
      reader.readRegistry([registryCheck]),
      reader.readTcp(),
      reader.readPower(['cpmincores']),
    ]);

    expect(calls).toContain(`reg.exe query ${registryCheck.key}`);
    expect(calls).toContain('netsh.exe int tcp show global');
    expect(calls).toContain('powercfg.exe /q SCHEME_CURRENT SUB_PROCESSOR CPMINCORES');
    expect(
      registry.get(
        'registry:hkcu\\software\\microsoft\\windows\\currentversion\\search|searchboxtaskbarmode'
      )
    ).toBe('0');
    expect(tcpCheckValue({ kind: 'tcp', setting: 'rsc', expected: 'disabled' }, tcp)).toBe(
      'disabled'
    );
    expect(powerCheckValue({ kind: 'power', setting: 'cpmincores', expected: '1' }, power)).toBe(
      '1'
    );
  });

  it('devolve null quando uma consulta falha, sem derrubar a análise', async () => {
    const exec: ExecFileFn = vi.fn(async () => {
      throw new Error('acesso negado');
    });
    const reader = createSystemStateReader(exec);
    const [registry, tcp, power] = await Promise.all([
      reader.readRegistry([registryCheck]),
      reader.readTcp(),
      reader.readPower(['standby-ac', 'standby-dc'] as PowerSetting[]),
    ]);

    expect(
      registry.get(
        'registry:hkcu\\software\\microsoft\\windows\\currentversion\\search|searchboxtaskbarmode'
      )
    ).toBeNull();
    expect(tcp).toBeNull();
    expect([...power.values()]).toEqual([null, null]);
  });
});
