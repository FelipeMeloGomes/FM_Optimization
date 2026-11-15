// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAST_ROUTE_KEY } from '../lib/last-route';
import { useLastRoute } from './use-last-route';

const KNOWN = ['/', '/cpu', '/rede', '/settings'];

function wrapperFor(initialEntries: string[]) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

/** Devolve a rota viva para o teste conferir para onde o app foi. */
function useHarness() {
  useLastRoute(KNOWN);
  return useLocation().pathname;
}

function renderAt(path: string) {
  return renderHook(() => useHarness(), { wrapper: wrapperFor([path]) });
}

describe('useLastRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('reabre na ultima rota visitada quando o app cai no Dashboard', async () => {
    // A janela e destruida ao fechar, entao toda reabertura comeca em '/'.
    window.localStorage.setItem(LAST_ROUTE_KEY, '/rede');

    const { result } = renderAt('/');

    await waitFor(() => expect(result.current).toBe('/rede'));
  });

  it('nao restaura rota que nao existe mais', async () => {
    window.localStorage.setItem(LAST_ROUTE_KEY, '/pagina-removida');

    const { result } = renderAt('/');

    await waitFor(() => expect(result.current).toBe('/'));
  });

  it('nao sequestra uma rota aberta de proposito (link direto)', async () => {
    window.localStorage.setItem(LAST_ROUTE_KEY, '/cpu');

    const { result } = renderAt('/settings');

    await waitFor(() => expect(result.current).toBe('/settings'));
  });

  it('grava a rota atual para a proxima abertura', async () => {
    renderAt('/settings');

    await waitFor(() => expect(window.localStorage.getItem(LAST_ROUTE_KEY)).toBe('/settings'));
  });

  it('nao sobrescreve a rota salva com o Dashboard antes de restaurar', async () => {
    window.localStorage.setItem(LAST_ROUTE_KEY, '/cpu');

    const { result } = renderAt('/');

    await waitFor(() => expect(result.current).toBe('/cpu'));
    expect(window.localStorage.getItem(LAST_ROUTE_KEY)).toBe('/cpu');
  });

  it('ignora lixo gravado por versao anterior', async () => {
    window.localStorage.setItem(LAST_ROUTE_KEY, 'null');

    const { result } = renderAt('/');

    await waitFor(() => expect(result.current).toBe('/'));
  });
});
