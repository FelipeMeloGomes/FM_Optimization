import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Abas simples, sem dependência nova: um grupo de botões com `role="tab"` e
 * navegação por teclado (setas), que é o mínimo que o padrão ARIA pede.
 */
export function Tabs({ items, value, onChange, className }: TabsProps) {
  function moveFocus(current: string, direction: 1 | -1) {
    const index = items.findIndex((item) => item.id === current);
    if (index < 0) return;
    const next = items[(index + direction + items.length) % items.length];
    onChange(next.id);
  }

  return (
    <div
      role="tablist"
      aria-label="Seções da inicialização"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveFocus(item.id, 1);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveFocus(item.id, -1);
              }
            }}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-mono',
                  active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
