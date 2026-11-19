import { describe, expect, it, vi } from 'vitest';
import type { OverlayGame } from '../../shared/overlay-types';
import {
  getForegroundPid,
  listRunningProcesses,
  parseForegroundPid,
  parseProcessList,
  selectActiveGame,
} from '../services/overlay-processes';

const cs2: OverlayGame = {
  id: 'cs2',
  name: 'Counter-Strike 2',
  exePath: 'C:\\Jogos\\CS2\\cs2.exe',
  processName: 'cs2.exe',
  coverFile: null,
  enabled: true,
};

const valorant: OverlayGame = { ...cs2, id: 'val', processName: 'VALORANT.exe' };
const disabled: OverlayGame = { ...cs2, id: 'off', processName: 'jogo.exe', enabled: false };

const running = [
  { processName: 'cs2.exe', pid: 10 },
  { processName: 'valorant.exe', pid: 30 },
  { processName: 'jogo.exe', pid: 20 },
];

describe('selectActiveGame', () => {
  it('prefere o jogo em foco entre os habilitados', () => {
    expect(selectActiveGame([cs2, valorant], running, 30, true)?.id).toBe('val');
  });

  it('cai para o primeiro habilitado quando o foco não é elegível', () => {
    expect(selectActiveGame([disabled, cs2], running, 20, true)?.id).toBe('cs2');
    expect(selectActiveGame([disabled, cs2], running, 999, true)?.id).toBe('cs2');
  });

  it('sem a opção de foco, usa o primeiro habilitado rodando', () => {
    expect(selectActiveGame([disabled, cs2], running, 30, false)?.id).toBe('cs2');
  });

  it('não seleciona jogos desabilitados nem parados', () => {
    expect(selectActiveGame([disabled], running, 20, true)).toBeNull();
    expect(selectActiveGame([cs2], [], 10, false)).toBeNull();
  });
});

describe('parsers do PowerShell', () => {
  it('faz parse da lista de processos', () => {
    expect(parseProcessList('10\tcs2.exe\r\n20\tCyberpunk2077.exe\n')).toEqual([
      { processName: 'cs2.exe', pid: 10 },
      { processName: 'Cyberpunk2077.exe', pid: 20 },
    ]);
  });

  it('ignora linhas inválidas e saída vazia', () => {
    expect(parseProcessList('')).toEqual([]);
    expect(parseProcessList('linha sem tab')).toEqual([]);
    expect(parseProcessList('abc\tcs2.exe')).toEqual([]);
  });

  it('faz parse do PID em foco', () => {
    expect(parseForegroundPid('1234\n')).toBe(1234);
    expect(parseForegroundPid('')).toBeNull();
    expect(parseForegroundPid('0')).toBeNull();
  });
});

describe('listRunningProcesses', () => {
  it('executa o PowerShell e devolve a lista', async () => {
    const execPowerShellSafe = vi.fn(async () => '42\tcs2.exe\n');
    await expect(listRunningProcesses({ execPowerShellSafe })).resolves.toEqual([
      { processName: 'cs2.exe', pid: 42 },
    ]);
    expect(execPowerShellSafe).toHaveBeenCalled();
  });

  it('devolve lista vazia quando o comando falha', async () => {
    const execPowerShellSafe = vi.fn(async () => {
      throw new Error('access denied');
    });
    await expect(listRunningProcesses({ execPowerShellSafe })).resolves.toEqual([]);
  });
});

describe('getForegroundPid', () => {
  it('devolve o PID da janela em foco', async () => {
    const execPowerShellSafe = vi.fn(async () => '99\n');
    await expect(getForegroundPid({ execPowerShellSafe })).resolves.toBe(99);
  });

  it('devolve null quando não há janela em foco', async () => {
    const execPowerShellSafe = vi.fn(async () => '0');
    await expect(getForegroundPid({ execPowerShellSafe })).resolves.toBeNull();
  });
});
