// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../electron/shared/ipc-types';

const { mockTheme, lenisState } = vi.hoisted(() => ({
  mockTheme: { value: 'dark' as AppSettings['theme'] },
  lenisState: { instances: 0 },
}));

/**
 * A rolagem da página precisa ser a nativa do navegador: o Lenis interceptava a
 * roda e travava antes do fim em listas virtualizadas (Tarefas agendadas).
 */
vi.mock('lenis', () => ({
  default: class {
    dimensions = { resize: () => {} };
    constructor() {
      lenisState.instances++;
    }
    destroy() {}
  },
}));

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
vi.mock('../hooks/use-update-toast', () => ({ useUpdateToast: () => {} }));
vi.mock('../hooks/use-script-execution-toast', () => ({ useScriptExecutionToast: () => {} }));
vi.mock('sonner', () => ({
  Toaster: ({ theme }: { theme: string }) => <div data-toaster-theme={theme} />,
}));
vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { theme: mockTheme.value } }),
}));
vi.mock('react-router-dom', () => ({ Outlet: () => <main>conteudo</main> }));

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('usa a rolagem nativa, sem instanciar Lenis', () => {
    lenisState.instances = 0;

    render(<AppLayout />);

    expect(lenisState.instances).toBe(0);
    expect(document.getElementById('main-content')?.className).toContain('overflow-y-auto');
  });

  it('renderiza o conteudo sem fundo animado', () => {
    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain('conteudo');
    expect(html).not.toMatch(/<canvas/);
    expect(html).not.toContain('backgroundComponent');
    expect(html).toContain('overscroll-contain');
  });

  it('usa o tema do Toaster conforme o tema configurado', () => {
    mockTheme.value = 'dark';
    expect(renderToStaticMarkup(<AppLayout />)).toContain('data-toaster-theme="dark"');

    mockTheme.value = 'light';
    const light = renderToStaticMarkup(<AppLayout />);
    expect(light).toContain('data-toaster-theme="light"');
    expect(light).not.toContain('richColors');
  });
});
