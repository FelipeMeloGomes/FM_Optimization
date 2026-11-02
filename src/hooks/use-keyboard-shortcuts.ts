import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Mapa estavel de Ctrl+1..9 para rota.
 *
 * Os oito primeiros slots sao o mapeamento historico, preservado de proposito:
 * Ctrl+4 continua sendo Rede, mesmo com a ordem do menu diferente. O nono slot
 * estava livre e recebeu Personalizacao, a pagina criada nesta reorganizacao.
 *
 * Rotas novas nao entram por derivacao de `ROUTES` porque isso deslocaria os
 * atalhos existentes. Titulos, icones e categorias continuam vindo de `ROUTES`;
 * aqui so ha caminhos, sem metadados duplicados.
 */
const SHORTCUT_PATHS = [
  '/',
  '/cpu',
  '/cleaner',
  '/rede',
  '/input-lag',
  '/utilities',
  '/privacidade-seguranca',
  '/restore-points',
  '/personalizacao',
] as const;

export const PAGE_ROUTES: readonly string[] = SHORTCUT_PATHS;

/** Rota de Ctrl+N, ou `undefined` quando a tecla nao e um slot valido. */
export function getShortcutRoute(key: string): string | undefined {
  if (key < '1' || key > '9') return undefined;
  return PAGE_ROUTES[Number(key) - 1];
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      const route = getShortcutRoute(e.key);
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
