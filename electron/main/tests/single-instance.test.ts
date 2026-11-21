import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão: o `instance.json` pode ficar órfão quando o app encerra de forma
 * anormal (crash, kill, desligamento). O Windows reaproveita o PID e, sem
 * validar a identidade do processo, o boot acha que existe uma instância
 * elevada viva e bloqueia a abertura com "já está aberto como administrador".
 */

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\Users\\Teste\\AppData\\Roaming\\fm-optimize' },
}));

import { isInstanceAlive, parseTasklistName } from '../services/single-instance';

function tasklistOutput(name: string, pid: number): string {
  return `"${name}","${pid}","Services","0","24 368 K"\r\n`;
}

describe('parseTasklistName', () => {
  it('extrai o nome do processo da saída CSV do tasklist', () => {
    expect(parseTasklistName(tasklistOutput('svchost.exe', 7500))).toBe('svchost.exe');
  });

  it('devolve null quando o tasklist não encontra o PID', () => {
    expect(
      parseTasklistName('INFO: No tasks are running which match the specified criteria.')
    ).toBeNull();
  });
});

describe('isInstanceAlive', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.execFile.mockReset();
  });

  it('não considera viva uma instância cujo PID foi reaproveitado por outro processo', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => true);
    mocks.execFile.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(null, tasklistOutput('svchost.exe', 7500), '');
    });

    const alive = await isInstanceAlive(
      {
        pid: 7500,
        elevated: true,
        startedAt: '2026-11-20T01:21:06.983Z',
      },
      'fm-optimize.exe'
    );

    expect(alive).toBe(false);
  });

  it('considera viva uma instância com o PID e o nome do executável corretos', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => true);
    mocks.execFile.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(null, tasklistOutput('fm-optimize.exe', 2608), '');
    });

    const alive = await isInstanceAlive(
      {
        pid: 2608,
        elevated: false,
        startedAt: '2026-11-21T03:47:30.007Z',
        processName: 'fm-optimize.exe',
      },
      'fm-optimize.exe'
    );

    expect(alive).toBe(true);
  });

  it('não considera viva uma instância cujo processo já terminou', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });

    const alive = await isInstanceAlive(
      { pid: 9999, elevated: false, startedAt: '2026-11-21T03:47:30.007Z' },
      'fm-optimize.exe'
    );

    expect(alive).toBe(false);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it('não confia no arquivo quando não consegue consultar o nome do processo', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => true);
    mocks.execFile.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(new Error('tasklist indisponível'), '', 'erro');
    });

    const alive = await isInstanceAlive(
      { pid: 7500, elevated: true, startedAt: '2026-11-20T01:21:06.983Z' },
      'fm-optimize.exe'
    );

    expect(alive).toBe(false);
  });
});
