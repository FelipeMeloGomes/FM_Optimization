import { Search } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rótulo acessível do campo (as páginas usam nomes diferentes). */
  ariaLabel: string;
  compact?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
  /** Campo sem borda/fundo, usado pelo palette de comandos. */
  bare?: boolean;
  type?: 'search' | 'text';
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      ariaLabel,
      compact = false,
      inputRef,
      wrapperClassName,
      bare = false,
      type = 'search',
      className,
      ...props
    },
    ref
  ) => {
    const setInputRef = (node: HTMLInputElement | null) => {
      assignRef(ref, node);
      assignRef(inputRef, node);
    };

    const field = {
      ...props,
      type,
      'aria-label': ariaLabel,
      ref: setInputRef,
      className: bare ? cn('w-full', className) : cn('pl-9', compact && 'h-9 pl-8', className),
    };

    return (
      <div className={cn('relative', wrapperClassName)}>
        <Search
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
            compact ? 'left-2.5 size-3.5' : 'left-3 size-4'
          )}
        />
        {bare ? <input {...field} /> : <Input {...field} />}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
