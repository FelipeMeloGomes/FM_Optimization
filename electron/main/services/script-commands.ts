export type InteractiveExtension = 'bat' | 'cmd' | 'ps1';

/**
 * Wrapper oculto que abre o script numa janela própria, espera ele terminar e
 * devolve o exit code real do filho. `cmd /c start /wait` não serve: testado no
 * Windows, ele devolve 0 mesmo quando o filho sai com 7.
 */
export const INTERACTIVE_WRAPPER_COMMAND =
  '$p = Start-Process -FilePath $env:FMOPT_CHILD_EXE -ArgumentList $env:FMOPT_CHILD_ARGS -Wait -PassThru; exit $p.ExitCode';

export interface InteractiveLaunch {
  command: string;
  args: string[];
  /** Variáveis extras a mesclar no ambiente do processo (o filho lê daqui). */
  env: Record<string, string>;
}

/**
 * O caminho do script vai por variável de ambiente para não depender de
 * escaping de aspas na linha de comando do PowerShell.
 */
export function buildInteractiveLaunch(
  ext: InteractiveExtension,
  filePath: string
): InteractiveLaunch {
  const env =
    ext === 'ps1'
      ? {
          FMOPT_CHILD_EXE: 'powershell.exe',
          FMOPT_CHILD_ARGS: `-NoProfile -ExecutionPolicy Bypass -File "${filePath}"`,
        }
      : {
          FMOPT_CHILD_EXE: 'cmd.exe',
          // `/c`, não `/k`: o `/k` mantém o cmd aberto e o exit code observado
          // seria o do interpretador, não o do script.
          FMOPT_CHILD_ARGS: `/c "${filePath}"`,
        };

  return {
    command: 'powershell.exe',
    args: ['-NoProfile', '-Command', INTERACTIVE_WRAPPER_COMMAND],
    env,
  };
}
