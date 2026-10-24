/**
 * Estado compartilhado do processo principal. Vive num módulo próprio para
 * `index.ts` e `ipc-handlers.ts` não dependerem um do outro.
 */
export const appState = {
  /** True quando o app está encerrando de verdade (e não escondendo no tray). */
  isQuitting: false,
};
