// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da página Privacidade: hero, seção Privacidade, esqueleto e erro.
 * `use-script-page` e `use-is-script-applied` são mockados na fronteira.
 */

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleConfirmExecute: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import PrivacySecurityPage from './PrivacySecurityPage';

const store = vi.hoisted<{
  page: AsyncState<ScriptEntry[]>;
  scripts: ScriptEntry[];
}>(() => ({
  page: { status: 'success', data: [] },
  scripts: [],
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

function render(): string {
  return text(renderToStaticMarkup(<PrivacySecurityPage />));
}

beforeEach(() => {
  store.page = { status: 'success', data: [] };
  store.scripts = [];
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

    const html = text(render());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('catálogo indisponível');
  });

  it('renderiza o herói e a seção Privacidade', () => {
    store.scripts = [script('apps-1', 'Telemetria')];

    const html = render();

    expect(html).toContain('Privacidade do Windows');
    expect(html).toContain('Privacidade');
    expect(html).toContain('Desative a telemetria');
    expect(html).not.toContain('animate-pulse');
  });

  it('lista cada script com nome e descrição', () => {
    store.scripts = [script('apps-1', 'Telemetria')];

    const html = render();

    expect(html).toContain('Telemetria');
    expect(html).toContain('Telemetria — desc');
  });
});
