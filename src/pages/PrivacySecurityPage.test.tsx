// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Privacidade: hero, seção Privacidade, esqueleto e erro.
 * `use-script-page` e `use-is-script-applied` são mockados na fronteira.
 *
 * A página agora usa seleção múltipla: `use-script-page` expõe a API de lote
 * (`handleApply`, `batch`, …) e o hook de seleção é o real (não mockado).
 */

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleApply: store.handleApply,
    batch: null,
    confirmBulkScripts: [],
    setConfirmBulkScripts: () => {},
    handleConfirmBulk: () => {},
    failedScripts: [],
    clearFailures: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

import PrivacySecurityPage from './PrivacySecurityPage';

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
  handleApply: ReturnType<typeof vi.fn>;
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
  handleApply: vi.fn(),
}));

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — desc`,
    category: 'Segurança',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderStatic(): string {
  return text(renderToStaticMarkup(<PrivacySecurityPage />));
}

function renderPage() {
  return render(<PrivacySecurityPage />);
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.handleApply = vi.fn();
});

describe('PrivacySecurityPage', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    store.page = { status: 'loading' };

    const html = renderToStaticMarkup(<PrivacySecurityPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Privacidade do Windows');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'catálogo indisponível' };

    const html = text(renderStatic());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('catálogo indisponível');
  });

  it('renderiza o herói e os scripts em uma única lista sem seções', () => {
    store.scripts = [script('apps-1', 'Telemetria')];

    renderPage();

    expect(screen.getByText('Privacidade do Windows')).toBeDefined();
    expect(screen.getByTestId('tweaks-list')).toBeDefined();
    expect(screen.getByText('Telemetria')).toBeDefined();
    expect(screen.queryByText(/Desative a telemetria e a coleta de dados do Windows/)).toBeNull();
  });

  it('lista cada script com nome e descrição', () => {
    store.scripts = [script('apps-1', 'Telemetria')];

    const html = renderStatic();

    expect(html).toContain('Telemetria');
    expect(html).toContain('Telemetria — desc');
  });

  it('mantém apps-1 e apps-2 visíveis e selecionáveis', () => {
    store.scripts = [script('apps-1', 'Telemetria'), script('apps-2', 'Apps sugeridos')];

    renderPage();

    expect(screen.getByText('Telemetria')).toBeDefined();
    expect(screen.getByText('Apps sugeridos')).toBeDefined();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Telemetria' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['apps-1']);
  });

  it('aplica apenas o tweak marcado ao clicar em Aplicar selecionados', () => {
    store.scripts = [script('apps-2', 'Apps sugeridos')];

    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Apps sugeridos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['apps-2']);
  });
});
