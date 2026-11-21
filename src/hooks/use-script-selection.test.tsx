// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useScriptSelection } from './use-script-selection';

/**
 * `useScriptSelection` guarda os ids marcados numa página de tweaks. A seleção
 * começa vazia, sobrevive a mudanças de filtro para os ids ainda visíveis e
 * descarta os ids que saíram da lista.
 */

function script(id: string): ScriptEntry {
  return {
    id,
    name: `Script ${id}`,
    description: '',
    category: 'CPU',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const A = script('a');
const B = script('b');

describe('useScriptSelection', () => {
  it('começa vazio e expõe os ids disponíveis', () => {
    const { result } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [A, B] } }
    );

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedScripts).toEqual([]);
    expect(result.current.availableIds).toEqual(['a', 'b']);
    expect(result.current.allSelected).toBe(false);
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('marca um id, alterna de volta e resolve os scripts marcados', () => {
    const { result } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [A, B] } }
    );

    act(() => result.current.toggle('a'));

    expect(result.current.selectedScripts.map((s) => s.id)).toEqual(['a']);
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isSelected('b')).toBe(false);
    expect(result.current.allSelected).toBe(false);

    act(() => result.current.toggle('a'));

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('seleciona tudo e limpa a seleção', () => {
    const { result } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [A, B] } }
    );

    act(() => result.current.selectAll());

    expect(result.current.selectedIds).toEqual(new Set(['a', 'b']));
    expect(result.current.selectedScripts).toEqual([A, B]);
    expect(result.current.allSelected).toBe(true);

    act(() => result.current.clear());

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedScripts).toEqual([]);
    expect(result.current.allSelected).toBe(false);
  });

  it('descarta ids que saíram da lista visível e mantém os que ficaram', () => {
    const { result, rerender } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [A, B] } }
    );

    act(() => result.current.selectAll());

    rerender({ scripts: [B] });

    expect(result.current.selectedIds).toEqual(new Set(['b']));
    expect(result.current.selectedScripts).toEqual([B]);
    expect(result.current.allSelected).toBe(true);
  });

  it('não considera tudo selecionado quando a lista está vazia', () => {
    const { result } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [] as ScriptEntry[] } }
    );

    expect(result.current.allSelected).toBe(false);

    act(() => result.current.selectAll());

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });

  it('preserva a identidade da seleção quando a lista visível não muda', () => {
    const { result, rerender } = renderHook(
      ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
      { initialProps: { scripts: [A, B] } }
    );

    act(() => result.current.toggle('a'));
    const before = result.current.selectedIds;

    rerender({ scripts: [A, B] });

    expect(result.current.selectedIds).toBe(before);
  });
});
