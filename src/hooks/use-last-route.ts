import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readLastRoute, writeLastRoute } from '../lib/last-route';

/**
 * Restaura a rota da sessão anterior quando o app abre no Dashboard e passa a
 * gravar cada navegação. A restauração acontece uma única vez, no primeiro
 * render: depois disso o usuário manda.
 */
export function useLastRoute(knownPaths: readonly string[]): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const handledFirstRender = useRef(false);

  useEffect(() => {
    if (handledFirstRender.current) return;
    handledFirstRender.current = true;
    if (pathname !== '/') return;

    const saved = readLastRoute(window.localStorage, knownPaths);
    if (saved && saved !== pathname) navigate(saved, { replace: true });
  }, [knownPaths, navigate, pathname]);

  useEffect(() => {
    if (!handledFirstRender.current) return;
    writeLastRoute(window.localStorage, pathname);
  }, [pathname]);
}
