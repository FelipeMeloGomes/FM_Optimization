/** Polyfills de browser usados por componentes de animação em jsdom. */

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      // jsdom não tem preferência do usuário; assumir movimento reduzido mantém
      // as animações determinísticas (sem frames pendentes entre os testes).
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      value: ResizeObserverStub,
      writable: true,
      configurable: true,
    });
  }

  if (!('IntersectionObserver' in window)) {
    class IntersectionObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      value: IntersectionObserverStub,
      writable: true,
      configurable: true,
    });
  }
}
