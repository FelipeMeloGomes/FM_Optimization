/**
 * Memória da última rota visitada.
 *
 * A janela do FM Optimize é destruída ao fechar (para liberar renderer e GPU),
 * então reabrir sempre cairia no Dashboard. Guardar a rota no `localStorage`
 * mantém a sensação de continuidade sem tocar no schema de `AppSettings`.
 */

export const LAST_ROUTE_KEY = 'fm-last-route';

export interface RouteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Só aceita caminho absoluto que exista hoje. Uma rota removida numa
 * atualização não pode virar tela em branco ao abrir o app.
 */
export function normalizeRoute(raw: string | null, knownPaths: readonly string[]): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/')) return null;
  return knownPaths.includes(path) ? path : null;
}

export function readLastRoute(storage: RouteStorage, knownPaths: readonly string[]): string | null {
  try {
    return normalizeRoute(storage.getItem(LAST_ROUTE_KEY), knownPaths);
  } catch {
    // localStorage indisponível (modo restrito/quota): abrir no Dashboard é aceitável.
    return null;
  }
}

export function writeLastRoute(storage: RouteStorage, path: string): void {
  try {
    storage.setItem(LAST_ROUTE_KEY, path);
  } catch {
    /* sem persistência: a próxima abertura volta ao Dashboard */
  }
}
