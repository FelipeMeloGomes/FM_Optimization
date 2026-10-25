import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { DEBLOAT_SCRIPT_IDS } from './app-sections';

export const CATEGORY_ROUTES: Record<string, string> = {
  Tweaks: '/tweaks',
  CPU: '/cpu',
  Cleaner: '/cleaner',
  Internet: '/rede',
  'DNS Manager': '/rede',
  'Input Lag': '/input-lag',
  Utilities: '/utilities',
  Apps: '/apps',
};

export function getCategoryRoute(category: string): string {
  return CATEGORY_ROUTES[category] || '/';
}

/**
 * A pagina Aplicativos e a Debloat dividem a categoria "Apps" do catalogo, entao
 * a categoria sozinha nao diz onde o script aparece. A busca usa isto para nao
 * mandar um script de debloat para uma pagina que nao o mostra.
 */
export function getScriptRoute(script: Pick<ScriptEntry, 'id' | 'category'>): string {
  if (DEBLOAT_SCRIPT_IDS.has(script.id)) return '/debloat';
  return getCategoryRoute(script.category);
}
