// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatestRequest } from './use-latest-request';

describe('useLatestRequest', () => {
  it('considera atual somente o último id emitido', () => {
    const { result } = renderHook(() => useLatestRequest());
    let first = 0;
    let second = 0;

    act(() => {
      first = result.current.next();
      second = result.current.next();
    });

    expect(second).toBe(first + 1);
    expect(result.current.isCurrent(second)).toBe(true);
    expect(result.current.isCurrent(first)).toBe(false);
  });

  it('invalida o id anterior sem emitir um novo id ao chamador', () => {
    const { result } = renderHook(() => useLatestRequest());
    let current = 0;

    act(() => {
      current = result.current.next();
      result.current.invalidate();
    });

    expect(result.current.isCurrent(current)).toBe(false);
  });

  it('já considera inválidos os ids pendentes após a desmontagem', () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    let current = 0;

    act(() => {
      current = result.current.next();
    });
    unmount();

    expect(result.current.isCurrent(current)).toBe(false);
  });
});
