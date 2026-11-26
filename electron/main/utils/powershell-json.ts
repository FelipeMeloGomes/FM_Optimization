export interface ParsePowerShellJsonOptions {
  label: string;
  emptyFallback?: unknown;
  onInvalid?: (raw: string) => unknown;
}

/** Converte a saída JSON de um cmdlet, mantendo as duas políticas de erro do projeto. */
export function parsePowerShellJson(raw: string, options: ParsePowerShellJsonOptions): unknown {
  if (!raw.trim()) {
    if (options.emptyFallback !== undefined) return options.emptyFallback;
    throw new Error(`Não foi possível ler as ${options.label}: resposta inválida`);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    if (options.onInvalid) return options.onInvalid(raw);
    throw new Error(`Não foi possível ler as ${options.label}: resposta inválida`);
  }
}
