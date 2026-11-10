// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCommandPalette } from './use-command-palette';

/**
 * Ctrl+K é o atalho global da paleta. O hook precisa abrir/fechar por clique e
 * por teclado, aceitar Cmd no macOS e remover o listener ao desmontar.
 */

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('useCommandPalette', () => {
  it('começa fechada', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);
  });

  it('abre, fecha e alterna por função', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('abre com Ctrl+K e previne o navegador', () => {
    const { result } = renderHook(() => useCommandPalette());

    const event = press('k', { ctrlKey: true });

    expect(result.current.isOpen).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('abre com Cmd+K no macOS', () => {
    const { result } = renderHook(() => useCommandPalette());

    press('k', { metaKey: true });

    expect(result.current.isOpen).toBe(true);
  });

  it('ignora K sem modificador e modificadores com outra tecla', () => {
    const { result } = renderHook(() => useCommandPalette());

    const plain = press('k');
    press('j', { ctrlKey: true });

    expect(result.current.isOpen).toBe(false);
    expect(plain.defaultPrevented).toBe(false);
  });

  it('remove o listener ao desmontar', () => {
    const { result, unmount } = renderHook(() => useCommandPalette());
    unmount();

    press('k', { ctrlKey: true });

    expect(result.current.isOpen).toBe(false);
  });
});
