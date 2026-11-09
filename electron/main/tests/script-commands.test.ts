import { describe, expect, it } from 'vitest';
import { buildInteractiveLaunch, INTERACTIVE_WRAPPER_COMMAND } from '../services/script-commands';

describe('buildInteractiveLaunch', () => {
  it('usa um wrapper oculto do PowerShell que espera o filho e propaga o exit code', () => {
    const launch = buildInteractiveLaunch('bat', 'C:\\Temp\\script.bat');

    expect(launch.command).toBe('powershell.exe');
    expect(launch.args).toEqual(['-NoProfile', '-Command', INTERACTIVE_WRAPPER_COMMAND]);
    expect(INTERACTIVE_WRAPPER_COMMAND).toContain('-Wait');
    expect(INTERACTIVE_WRAPPER_COMMAND).toContain('-PassThru');
    expect(INTERACTIVE_WRAPPER_COMMAND).toContain('exit $p.ExitCode');
  });

  it('abre bat/cmd com /c para preservar o codigo de saida do script', () => {
    expect(buildInteractiveLaunch('bat', 'C:\\Temp\\script.bat').env).toEqual({
      FMOPT_CHILD_EXE: 'cmd.exe',
      FMOPT_CHILD_ARGS: '/c "C:\\Temp\\script.bat"',
    });
    expect(buildInteractiveLaunch('cmd', 'C:\\Temp\\script.cmd').env.FMOPT_CHILD_ARGS).toBe(
      '/c "C:\\Temp\\script.cmd"'
    );
  });

  it('abre ps1 num powershell visivel com o caminho entre aspas', () => {
    expect(buildInteractiveLaunch('ps1', 'C:\\My Temp\\my script.ps1').env).toEqual({
      FMOPT_CHILD_EXE: 'powershell.exe',
      FMOPT_CHILD_ARGS: '-NoProfile -ExecutionPolicy Bypass -File "C:\\My Temp\\my script.ps1"',
    });
  });

  it('nunca usa /k: o cmd devolveria o proprio codigo, nao o do script', () => {
    expect(
      buildInteractiveLaunch('bat', 'C:\\Temp\\script.bat').env.FMOPT_CHILD_ARGS
    ).not.toContain('/k');
  });
});
