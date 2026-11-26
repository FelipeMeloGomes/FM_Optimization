import { useCallback, useEffect, useRef } from 'react';

export interface LatestRequest {
  next(): number;
  isCurrent(request: number): boolean;
  invalidate(): void;
}

/** Identifica a requisição mais recente e descarta respostas obsoletas. */
export function useLatestRequest(): LatestRequest {
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      counter.current += 1;
    };
  }, []);

  const next = useCallback(() => {
    counter.current += 1;
    return counter.current;
  }, []);

  const isCurrent = useCallback(
    (request: number) => mounted.current && request === counter.current,
    []
  );

  const invalidate = useCallback(() => {
    counter.current += 1;
  }, []);

  return { next, isCurrent, invalidate };
}
