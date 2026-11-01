import type { ElementType, ReactNode } from 'react';

interface ProviderProps {
  children: ReactNode;
}

export function composeProviders(
  ...providers: Array<ElementType<ProviderProps>>
): React.FC<{ children: ReactNode }> {
  // biome-ignore lint/correctness/noComponentHookFactories: composição fixa, avaliada uma vez na inicialização do app
  return function ComposedProviders({ children }) {
    return providers.reduceRight(
      (content, Provider, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable provider order, index is safe
        <Provider key={index}>{content}</Provider>
      ),
      children
    );
  };
}
