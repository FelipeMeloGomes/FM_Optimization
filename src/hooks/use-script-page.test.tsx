// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * `useScriptPage` liga a página ao filtro do catálogo: uma categoria vira filtro
 * do contexto, várias categorias limpam o filtro e recortam a lista localmente,
 * e a confirmação só aparece quando `confirmOnExecute` está ligado.
 */

const store = vi.hoisted(() => ({
  scriptState: { status: 'success', data: [] } as AsyncState<ScriptEntry[]>,
  filteredScripts: [] as ScriptEntry[],
  setCategoryFilter: vi.fn(),
  setSubcategoryFilter: vi.fn(),
  activeExecution: null as string | null,
  execute: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
  confirmOnExecute: false,
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({
    state: store.scriptState,
    filteredScripts: store.filteredScripts,
    categoryFilter: '',
    subcategoryFilter: '',
    subcategories: [],
    setCategoryFilter: store.setCategoryFilter,
    setSubcategoryFilter: store.setSubcategoryFilter,
  }),
}));

vi.mock('../contexts/ScriptExecutionContext', () => ({
  useScriptExecutionContext: () => ({
    activeExecution: store.activeExecution,
    execute: store.execute,
    cancel: store.cancel,
  }),
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: { confirmOnExecute: store.confirmOnExecute },
    update: () => {},
    loading: false,
  }),
}));

import { useScriptPage } from './use-script-page';

function script(id: string, category: string, subcategory = ''): ScriptEntry {
  return {
    id,
    name: `Script ${id}`,
    description: '',
    category,
    subcategory,
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const SCRIPTS = [script('cpu-1', 'CPU'), script('gpu-1', 'GPU'), script('cpu-2', 'CPU')];

beforeEach(() => {
  store.scriptState = { status: 'success', data: SCRIPTS };
  store.filteredScripts = SCRIPTS;
  store.activeExecution = null;
  store.confirmOnExecute = false;
  store.setCategoryFilter.mockClear();
  store.setSubcategoryFilter.mockClear();
  store.execute.mockClear();
  store.cancel.mockClear();
});

describe('useScriptPage — filtro de categoria', () => {
  it('aplica a categoria única no contexto e limpa a subcategoria', () => {
    const { result } = renderHook(() => useScriptPage('CPU'));

    expect(store.setCategoryFilter).toHaveBeenCalledTimes(1);
    expect(store.setCategoryFilter).toHaveBeenCalledWith('CPU');
    expect(store.setSubcategoryFilter).toHaveBeenCalledWith('');
    expect(result.current.categoryScripts.map((s) => s.id)).toEqual(['cpu-1', 'cpu-2']);
  });

  it('limpa o filtro do contexto e recorta várias categorias na lista local', () => {
    const { result } = renderHook(() => useScriptPage(['CPU', 'GPU']));

    expect(store.setCategoryFilter).toHaveBeenCalledWith('');
    expect(result.current.categoryScripts.map((s) => s.id)).toEqual(['cpu-1', 'gpu-1', 'cpu-2']);
  });

  it('sem categoria, não lista nada e mantém o contexto sem filtro', () => {
    const { result } = renderHook(() => useScriptPage(''));

    expect(store.setCategoryFilter).toHaveBeenCalledWith('');
    expect(result.current.categoryScripts).toEqual([]);
  });

  it('não reaplica o filtro quando o array é recriado com o mesmo conteúdo', () => {
    const { rerender } = renderHook(({ cats }: { cats: string[] }) => useScriptPage(cats), {
      initialProps: { cats: ['CPU'] },
    });

    rerender({ cats: ['CPU'] });

    expect(store.setCategoryFilter).toHaveBeenCalledTimes(1);
    expect(store.setSubcategoryFilter).toHaveBeenCalledTimes(1);
  });

  it('reaplica o filtro quando a categoria realmente muda', () => {
    const { rerender } = renderHook(({ cat }: { cat: string }) => useScriptPage(cat), {
      initialProps: { cat: 'CPU' },
    });

    rerender({ cat: 'GPU' });

    expect(store.setCategoryFilter).toHaveBeenCalledTimes(2);
    expect(store.setCategoryFilter).toHaveBeenLastCalledWith('GPU');
  });

  it('repassa o estado do catálogo', () => {
    store.scriptState = { status: 'error', error: 'falha ao ler scripts.json' };

    const { result } = renderHook(() => useScriptPage('CPU'));

    expect(result.current.state).toEqual({ status: 'error', error: 'falha ao ler scripts.json' });
  });

  it('repassa a execução ativa', () => {
    store.activeExecution = 'cpu-1';

    const { result } = renderHook(() => useScriptPage('CPU'));

    expect(result.current.activeExecution).toBe('cpu-1');
  });
});

describe('useScriptPage — execução', () => {
  it('executa direto quando a confirmação está desligada', () => {
    const { result } = renderHook(() => useScriptPage('CPU'));
    const target = SCRIPTS[0];

    act(() => {
      result.current.handleConfirmExecute(target);
    });

    expect(store.execute).toHaveBeenCalledTimes(1);
    expect(store.execute).toHaveBeenCalledWith('cpu-1');
    expect(result.current.confirmScript).toBeNull();
  });

  it('pede confirmação quando a opção está ligada', () => {
    store.confirmOnExecute = true;
    const { result } = renderHook(() => useScriptPage('CPU'));
    const target = SCRIPTS[0];

    act(() => {
      result.current.handleConfirmExecute(target);
    });

    expect(store.execute).not.toHaveBeenCalled();
    expect(result.current.confirmScript?.id).toBe('cpu-1');
  });

  it('executa o script pendente ao confirmar', () => {
    store.confirmOnExecute = true;
    const { result } = renderHook(() => useScriptPage('CPU'));

    act(() => {
      result.current.handleConfirmExecute(SCRIPTS[1]);
    });
    act(() => {
      result.current.handleConfirm();
    });

    expect(store.execute).toHaveBeenCalledWith('gpu-1');
  });

  it('confirmar sem script pendente não executa nada', () => {
    const { result } = renderHook(() => useScriptPage('CPU'));

    act(() => {
      result.current.handleConfirm();
    });

    expect(store.execute).not.toHaveBeenCalled();
  });

  it('permite limpar o script pendente', () => {
    store.confirmOnExecute = true;
    const { result } = renderHook(() => useScriptPage('CPU'));

    act(() => {
      result.current.handleConfirmExecute(SCRIPTS[0]);
    });
    act(() => {
      result.current.setConfirmScript(null);
    });

    expect(result.current.confirmScript).toBeNull();
  });

  it('repassa execução e cancelamento por id', () => {
    const { result } = renderHook(() => useScriptPage('CPU'));

    act(() => {
      void result.current.handleExecute('cpu-2');
    });
    act(() => {
      void result.current.handleCancel('cpu-2');
    });

    expect(store.execute).toHaveBeenCalledWith('cpu-2');
    expect(store.cancel).toHaveBeenCalledWith('cpu-2');
  });
});
