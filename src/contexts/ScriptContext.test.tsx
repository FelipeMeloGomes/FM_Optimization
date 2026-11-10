// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

import { ScriptProvider, useScriptContext } from './ScriptContext';

function makeScript(overrides: Partial<ScriptEntry> & { id: string }): ScriptEntry {
  return {
    name: overrides.id,
    description: '',
    category: 'rede',
    subcategory: '',
    content: '',
    extension: 'bat',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
    ...overrides,
  };
}

const SCRIPTS: ScriptEntry[] = [
  makeScript({ id: 'dns', category: 'rede', subcategory: 'dns' }),
  makeScript({ id: 'proxy', category: 'rede', subcategory: 'proxy' }),
  makeScript({ id: 'firewall', category: 'sistema', subcategory: 'dns' }),
  makeScript({ id: 'limpeza', category: 'sistema' }),
  makeScript({ id: 'ping', category: 'jogos', subcategory: 'dns' }),
];

function installApi() {
  const api = {
    getScripts: vi.fn<() => Promise<ScriptEntry[]>>(async () => SCRIPTS),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

function Probe() {
  const {
    state,
    filteredScripts,
    categoryFilter,
    subcategoryFilter,
    subcategories,
    setCategoryFilter,
    setSubcategoryFilter,
  } = useScriptContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="filtered">{filteredScripts.map((s) => s.id).join(',')}</span>
      <span data-testid="subcategories">{subcategories.join(',')}</span>
      <span data-testid="category">{categoryFilter}</span>
      <span data-testid="subcategory">{subcategoryFilter}</span>
      <button type="button" onClick={() => setCategoryFilter('rede')}>
        categoria rede
      </button>
      <button type="button" onClick={() => setCategoryFilter('jogos')}>
        categoria jogos
      </button>
      <button type="button" onClick={() => setCategoryFilter('')}>
        limpar categoria
      </button>
      <button type="button" onClick={() => setSubcategoryFilter('dns')}>
        subcategoria dns
      </button>
      <button type="button" onClick={() => setSubcategoryFilter('')}>
        limpar subcategoria
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ScriptProvider>
      <Probe />
    </ScriptProvider>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('ScriptProvider', () => {
  it('começa em loading e publica todos os scripts', async () => {
    installApi();
    renderProvider();

    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(screen.getByTestId('filtered').textContent).toBe('');

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('filtered').textContent).toBe('dns,proxy,firewall,limpeza,ping');
    expect(screen.getByTestId('category').textContent).toBe('');
    expect(screen.getByTestId('subcategory').textContent).toBe('');
  });

  it('expõe erro e mantém a lista vazia', async () => {
    const api = installApi();
    api.getScripts.mockRejectedValue(new Error('catálogo indisponível'));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('catálogo indisponível');
    expect(screen.getByTestId('filtered').textContent).toBe('');
  });

  it('usa a string crua quando a rejeição não é Error', async () => {
    const api = installApi();
    api.getScripts.mockRejectedValue('falha crua');
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('falha crua');
  });

  it('filtra por categoria e recalcula as subcategorias da categoria', async () => {
    installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    act(() => screen.getByRole('button', { name: 'categoria rede' }).click());

    expect(screen.getByTestId('filtered').textContent).toBe('dns,proxy');
    expect(screen.getByTestId('subcategories').textContent).toBe('dns,proxy');
    expect(screen.getByTestId('category').textContent).toBe('rede');
  });

  it('combina categoria e subcategoria', async () => {
    installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    act(() => screen.getByRole('button', { name: 'categoria rede' }).click());
    act(() => screen.getByRole('button', { name: 'subcategoria dns' }).click());

    expect(screen.getByTestId('filtered').textContent).toBe('dns');
    expect(screen.getByTestId('subcategory').textContent).toBe('dns');
  });

  it('limpa os filtros e volta à lista completa', async () => {
    installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    act(() => screen.getByRole('button', { name: 'categoria jogos' }).click());
    expect(screen.getByTestId('filtered').textContent).toBe('ping');

    act(() => screen.getByRole('button', { name: 'subcategoria dns' }).click());
    act(() => screen.getByRole('button', { name: 'limpar subcategoria' }).click());
    act(() => screen.getByRole('button', { name: 'limpar categoria' }).click());

    expect(screen.getByTestId('filtered').textContent).toBe('dns,proxy,firewall,limpeza,ping');
    expect(screen.getByTestId('category').textContent).toBe('');
    expect(screen.getByTestId('subcategory').textContent).toBe('');
  });

  it('lista subcategorias sem repetição e em ordem alfabética', async () => {
    installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    // 'dns' aparece em três categorias mas só entra uma vez; 'limpeza' não tem subcategoria.
    expect(screen.getByTestId('subcategories').textContent).toBe('dns,proxy');
  });
});

describe('useScriptContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useScriptContext must be used within ScriptProvider');

    consoleError.mockRestore();
  });
});
