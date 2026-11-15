// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * O fundo animado custava ~13 pontos percentuais de um nucleo e ~40 MB com a
 * janela parada (A/B com p = 0,0022). O layout nao deve voltar a montar canvas
 * nem nenhum efeito de fundo por tema.
 */

vi.mock('./Sidebar', () => ({ Sidebar: () => <nav>sidebar</nav> }));
vi.mock('./TitleBar', () => ({ TitleBar: () => <div>titulo</div> }));
vi.mock('../components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../hooks/use-command-palette', () => ({
  useCommandPalette: () => ({ isOpen: false, open: () => {}, close: () => {} }),
}));
vi.mock('../hooks/use-keyboard-shortcuts', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../hooks/use-smooth-scroll', () => ({ useSmoothScroll: () => {} }));
vi.mock('../hooks/use-update-toast', () => ({ useUpdateToast: () => {} }));
vi.mock('../hooks/use-script-execution-toast', () => ({ useScriptExecutionToast: () => {} }));
vi.mock('sonner', () => ({ Toaster: () => null }));
vi.mock('react-router-dom', () => ({ Outlet: () => <main>conteudo</main> }));

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('renderiza o conteudo sem fundo animado', () => {
    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain('conteudo');
    expect(html).not.toMatch(/<canvas/);
    expect(html).not.toContain('backgroundComponent');
  });
});
