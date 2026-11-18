import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));

import { execPowerShell, execPowerShellSafe } from '../services/powershell';

function fakeProcess(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

function finish(proc: ReturnType<typeof fakeProcess>, output: string): void {
  proc.stdout.emit('data', Buffer.from(output));
  proc.emit('close', 0);
}

describe('execPowerShell — saída UTF-8', () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  it('define OutputEncoding UTF-8 antes do script do inventário Appx', async () => {
    const proc = fakeProcess();
    spawn.mockReturnValue(proc);

    const promise = execPowerShell('Get-AppxPackage | ConvertTo-Json');
    finish(proc, '[]\n');
    await promise;

    const script = spawn.mock.calls[0][1][5] as string;
    const utf8Directive = '[Console]::OutputEncoding = [Text.Encoding]::UTF8';
    expect(script).toContain(utf8Directive);
    expect(script.indexOf(utf8Directive)).toBeLessThan(script.indexOf('Get-AppxPackage'));
  });

  it('define OutputEncoding UTF-8 também em execPowerShellSafe', async () => {
    const proc = fakeProcess();
    spawn.mockReturnValue(proc);

    const promise = execPowerShellSafe('Get-CimInstance', ['Win32_Processor']);
    finish(proc, '{}\n');
    await promise;

    const command = spawn.mock.calls[0][1][5] as string;
    expect(command).toContain('[Console]::OutputEncoding = [Text.Encoding]::UTF8');
    expect(command).toContain('Get-CimInstance Win32_Processor');
  });

  it(' preserva acentos no JSON devolvido pelo PowerShell', async () => {
    const proc = fakeProcess();
    spawn.mockReturnValue(proc);

    const expected = 'Pacote de Experiência Local em Português (Brasil)';
    const promise = execPowerShell('Get-AppxPackageManifest');
    finish(proc, `${JSON.stringify({ displayName: expected })}\n`);

    await expect(promise).resolves.toContain(expected);
  });
});
