/** Normaliza qualquer valor lançado por IPC/PowerShell em uma mensagem legível. */
export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
