import type { ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Uma categoria do catalogo corresponde a uma unica pagina (ou, no caso das
 * tres categorias da pagina Desempenho, a mesma rota). A pagina Aplicativos e a
 * pagina Ajustes foram removidas na refatoracao: seus scripts ganharam a
 * categoria da pagina que os mostra, entao a busca do Ctrl+K acha o destino so
 * pela categoria.
 */
export const CATEGORY_ROUTES: Record<string, string> = {
  Cleaner: '/cleaner',
  CPU: '/cpu',
  GPU: '/cpu',
  Windows: '/cpu',
  Internet: '/rede',
  'DNS Manager': '/rede',
  'Input Lag': '/input-lag',
  Utilities: '/utilities',
  Debloat: '/debloat',
  Personalização: '/personalizacao',
  Segurança: '/privacidade-seguranca',
};

export function getCategoryRoute(category: string): string {
  return CATEGORY_ROUTES[category] || '/';
}

/** Rota da pagina do script. `id` fica no tipo porque os chamadores passam o script inteiro. */
export function getScriptRoute(script: Pick<ScriptEntry, 'id' | 'category'>): string {
  return getCategoryRoute(script.category);
}
