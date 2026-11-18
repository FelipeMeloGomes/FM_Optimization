/**
 * Identidade dos itens de limpeza por item.
 *
 * Só o id cruza o IPC: os caminhos de disco vivem no processo main
 * (`services/cleaner-items.ts`). Assim um renderer comprometido não consegue
 * apontar a limpeza para uma pasta arbitrária.
 */
export const CLEANER_ITEM_IDS = [
  'temp-user',
  'temp-windows',
  'prefetch',
  'windows-update',
  'directx',
  'chrome',
  'edge',
  'firefox',
  'brave',
] as const;

export type CleanerItemId = (typeof CLEANER_ITEM_IDS)[number];

export type CleanerItemGroup = 'sistema' | 'atualizacoes' | 'navegadores';
