import { useCallback, useEffect, useRef, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import type { AsyncState } from '../../electron/shared/ipc-types';
import { useLatestRequest } from './use-latest-request';

export interface UseAsyncDataOptions<T> {
  autoLoad?: boolean;
  onSuccess?: (data: T) => void;
}

export interface AsyncDataResult<T> {
  state: AsyncState<T>;
  reload: () => void;
  setData: (updater: (current: T) => T) => void;
}

/** Carrega dados assíncronos ignorando respostas de requisições superadas ou após desmontagem. */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
): AsyncDataResult<T> {
  const { autoLoad = true, onSuccess } = options;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const { next, isCurrent } = useLatestRequest();

  const reload = useCallback(() => {
    const request = next();
    setState({ status: 'loading' });

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => {
        if (!isCurrent(request)) return;
        setState({ status: 'success', data });
        onSuccessRef.current?.(data);
      })
      .catch((error: unknown) => {
        if (!isCurrent(request)) return;
        setState({ status: 'error', error: toErrorMessage(error) });
      });
  }, [isCurrent, next]);

  useEffect(() => {
    if (autoLoad) reload();
  }, [autoLoad, reload]);

  const setData = useCallback((updater: (current: T) => T) => {
    setState((current) =>
      current.status === 'success' ? { status: 'success', data: updater(current.data) } : current
    );
  }, []);

  return { state, reload, setData };
}
