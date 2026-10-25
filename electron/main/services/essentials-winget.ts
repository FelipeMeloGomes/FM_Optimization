/**
 * Helpers puros para interpretar a saida do `winget install`.
 *
 * O winget escreve progresso com `\r` e codigos ANSI na mesma linha, entao a
 * leitura e feita sobre o buffer acumulado: sempre vale a ultima ocorrencia.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: sequencias ANSI comecam com ESC
const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const PROGRESS_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB)/gi;

const UNIT_BYTES: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export interface WingetProgress {
  receivedBytes: number;
  totalBytes: number;
  /** 0 a 100, arredondado. */
  percent: number;
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function toBytes(value: string, unit: string): number {
  return Number(value.replace(',', '.')) * UNIT_BYTES[unit.toUpperCase()];
}

/** Ultima barra `10.5 MB / 45.8 MB` do buffer, ou null se ainda nao apareceu. */
export function parseWingetProgress(output: string): WingetProgress | null {
  const text = stripAnsi(output);
  let last: RegExpExecArray | null = null;

  PROGRESS_PATTERN.lastIndex = 0;
  let match = PROGRESS_PATTERN.exec(text);
  while (match) {
    last = match;
    match = PROGRESS_PATTERN.exec(text);
  }
  if (!last) return null;

  const receivedBytes = toBytes(last[1], last[2]);
  const totalBytes = toBytes(last[3], last[4]);
  if (!Number.isFinite(receivedBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return null;
  }

  const percent = Math.min(100, Math.max(0, Math.round((receivedBytes / totalBytes) * 100)));
  return { receivedBytes, totalBytes, percent };
}

export function parseWingetPercent(output: string): number | null {
  return parseWingetProgress(output)?.percent ?? null;
}

/** Fase atual do winget, para a UI trocar o texto do progresso. */
export function detectWingetPhase(output: string): 'downloading' | 'installing' | null {
  const text = stripAnsi(output).toLowerCase();
  const installing = Math.max(
    text.lastIndexOf('starting package install'),
    text.lastIndexOf('installing'),
    text.lastIndexOf('instalando')
  );
  const downloading = Math.max(text.lastIndexOf('downloading'), text.lastIndexOf('baixando'));

  if (installing === -1 && downloading === -1) return null;
  return installing > downloading ? 'installing' : 'downloading';
}

export function isWingetAlreadyInstalled(output: string): boolean {
  const text = stripAnsi(output).toLowerCase();
  return (
    text.includes('already installed') ||
    text.includes('já está instalado') ||
    text.includes('ja esta instalado') ||
    text.includes('no applicable update') ||
    text.includes('nenhuma atualização aplicável') ||
    text.includes('nenhuma atualizacao aplicavel')
  );
}

export function isWingetSuccess(output: string): boolean {
  const text = stripAnsi(output).toLowerCase();
  return /successfully installed|instalado com (êxito|exito)|instalação concluída|instalacao concluida|installation completed/.test(
    text
  );
}

/** Ultima linha com texto util: descarta barras de progresso e linhas vazias. */
export function lastMeaningfulLine(output: string, maxLength = 180): string | null {
  const lines = stripAnsi(output)
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /[a-z]{3,}/i.test(line));

  const last = lines.at(-1);
  if (!last) return null;
  return last.length > maxLength ? `${last.slice(0, maxLength - 1)}…` : last;
}

/**
 * Mensagem amigavel para o usuario. O winget fala portugues ou ingles conforme
 * o Windows; `code` e o exit code do processo (null = winget nem iniciou).
 */
export function wingetErrorMessage(code: number | null, output: string): string {
  if (code === null) {
    return 'O winget não foi encontrado. Instale o App Installer pela Microsoft Store e tente de novo.';
  }

  const text = stripAnsi(output).toLowerCase();

  if (/hash (?:does not match|mismatch)|hash não corresponde|hash nao corresponde/.test(text)) {
    return 'A verificação de integridade do winget falhou. O download foi descartado por segurança.';
  }
  if (/no package found|nenhum pacote corresponde|no applicable installer/.test(text)) {
    return 'O winget não encontrou um instalador compatível para este programa.';
  }
  if (/prohibits (?:running )?elevat|proíbe elevação|proibe elevacao/.test(text)) {
    return 'O instalador recusou rodar como administrador. Feche o FM Optimize e abra sem privilégios de administrador para instalar.';
  }
  if (/requires administrator|executar como administrador|elevação|elevaca|elevated/.test(text)) {
    return 'O winget precisa de permissão de administrador para instalar este programa.';
  }

  const detail = lastMeaningfulLine(output);
  const hex = `0x${(code >>> 0).toString(16)}`;
  return detail
    ? `O winget falhou ao instalar (${hex}): ${detail}`
    : `O winget falhou ao instalar (${hex}).`;
}
