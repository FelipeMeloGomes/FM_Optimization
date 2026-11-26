// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAsyncData } from './use-async-data';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAsyncData', () => {
  it('carrega automaticamente e publica os dados', async () => {
    const { result } = renderHook(() => useAsyncData(async () => 'pronto'));

    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'success', data: 'pronto' })
    );
  });

  it('não carrega automaticamente quando autoLoad é false', async () => {
    const loader = vi.fn(async () => 'pronto');
    const { result } = renderHook(() => useAsyncData(loader, { autoLoad: false }));

    expect(result.current.state).toEqual({ status: 'loading' });
    expect(loader).not.toHaveBeenCalled();

    act(() => result.current.reload());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'success', data: 'pronto' })
    );
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('normaliza Error e string em mensagens de erro', async () => {
    const first = renderHook(() =>
      useAsyncData<string>(() => Promise.reject(new Error('falha de rede')))
    );
    await waitFor(() => expect(first.result.current.state).toMatchObject({ status: 'error' }));
    expect(first.result.current.state).toEqual({ status: 'error', error: 'falha de rede' });

    const second = renderHook(() => useAsyncData<string>(() => Promise.reject('falha crua')));
    await waitFor(() => expect(second.result.current.state).toMatchObject({ status: 'error' }));
    expect(second.result.current.state).toEqual({ status: 'error', error: 'falha crua' });
  });

  it('volta para loading sincronamente ao recarregar', async () => {
    const pending = deferred<string>();
    const loader = vi.fn(() => pending.promise);
    const { result } = renderHook(() => useAsyncData(loader, { autoLoad: false }));

    act(() => result.current.reload());
    expect(result.current.state).toEqual({ status: 'loading' });

    await act(async () => {
      pending.resolve('carregado');
      await pending.promise;
    });
    expect(result.current.state).toEqual({ status: 'success', data: 'carregado' });
  });

  it('descarta a resposta de uma requisição antiga', async () => {
    const old = deferred<string>();
    const latest = deferred<string>();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useAsyncData(loader, { autoLoad: false }));

    act(() => result.current.reload());
    act(() => result.current.reload());

    await act(async () => {
      old.resolve('antigo');
      await old.promise;
    });
    expect(result.current.state).toEqual({ status: 'loading' });

    await act(async () => {
      latest.resolve('recente');
      await latest.promise;
    });
    expect(result.current.state).toEqual({ status: 'success', data: 'recente' });
  });

  it('ignora a rejeição de uma requisição antiga', async () => {
    const old = deferred<string>();
    const latest = deferred<string>();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useAsyncData(loader, { autoLoad: false }));

    act(() => result.current.reload());
    act(() => result.current.reload());

    await act(async () => {
      old.reject(new Error('erro antigo'));
      await old.promise.catch(() => {});
    });
    expect(result.current.state).toEqual({ status: 'loading' });

    await act(async () => {
      latest.resolve('recente');
      await latest.promise;
    });
    expect(result.current.state).toEqual({ status: 'success', data: 'recente' });
  });

  it('não atualiza o estado depois da desmontagem', async () => {
    const pending = deferred<string>();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAsyncData(() => pending.promise));

    unmount();
    await act(async () => {
      pending.resolve('tarde demais');
      await pending.promise;
    });

    expect(result.current.state).toEqual({ status: 'loading' });
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a React state update"),
      expect.anything()
    );
  });

  it('setData altera apenas um estado de sucesso', async () => {
    const pending = deferred<string>();
    const { result, rerender } = renderHook(
      ({ loader }) => useAsyncData(loader, { autoLoad: false }),
      { initialProps: { loader: () => pending.promise } }
    );

    act(() => result.current.setData((current) => `${current}!`));
    expect(result.current.state).toEqual({ status: 'loading' });

    act(() => result.current.reload());
    await act(async () => {
      pending.resolve('base');
      await pending.promise;
    });
    act(() => result.current.setData((current) => `${current}!`));
    expect(result.current.state).toEqual({ status: 'success', data: 'base!' });

    rerender({ loader: async () => 'nova' });
    expect(result.current.state).toEqual({ status: 'success', data: 'base!' });
  });

  it('chama onSuccess somente para a requisição atual', async () => {
    const old = deferred<string>();
    const latest = deferred<string>();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAsyncData(loader, { autoLoad: false, onSuccess }));

    act(() => result.current.reload());
    act(() => result.current.reload());

    await act(async () => {
      old.resolve('antigo');
      await old.promise;
    });
    await act(async () => {
      latest.resolve('recente');
      await latest.promise;
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('recente');
    expect(result.current.state).toEqual({ status: 'success', data: 'recente' });
  });
});
