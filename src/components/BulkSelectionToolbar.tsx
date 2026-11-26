import { Loader2, Zap } from 'lucide-react';
import { Badge, Button } from './ui';

export interface BulkSelectionToolbarProps<T> {
  availableIds: string[];
  selectedIds: Set<string>;
  selectedItems: T[];
  onSelectAll: () => void;
  onClear: () => void;
  onApply: (items: T[]) => void;
  applying: boolean;
  progress: { index: number; total: number } | null;
  failedItems: T[];
  onDismissFailures: () => void;
  getItemId: (item: T) => string;
  getItemName: (item: T) => string;
  selectAllLabel?: string;
  clearLabel?: string;
  applyLabel?: string;
  applyingLabel?: string;
  failureLabel?: (count: number) => string;
  checkboxId?: string;
}

/** Barra genérica de seleção em lote, com progresso e alerta de falhas. */
export function BulkSelectionToolbar<T>({
  availableIds,
  selectedIds,
  selectedItems,
  onSelectAll,
  onClear,
  onApply,
  applying,
  progress,
  failedItems,
  onDismissFailures,
  getItemId,
  getItemName,
  selectAllLabel = 'Selecionar todos',
  clearLabel = 'Limpar seleção',
  applyLabel = 'Aplicar selecionados',
  applyingLabel = 'Aplicando…',
  failureLabel = (count) => (count === 1 ? 'Falhou o tweak' : 'Falharam os tweaks'),
  checkboxId = 'select-all-tweaks',
}: BulkSelectionToolbarProps<T>) {
  const selectedCount = availableIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = availableIds.length > 0 && availableIds.every((id) => selectedIds.has(id));

  const handleSelectAllClick = () => {
    if (allSelected) {
      onClear();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={checkboxId} className="flex items-center gap-2 text-sm text-foreground">
          <input
            id={checkboxId}
            type="checkbox"
            className="size-4 accent-primary"
            checked={allSelected}
            onChange={handleSelectAllClick}
            disabled={availableIds.length === 0 || applying}
          />
          {selectAllLabel}
          <span className="text-xs text-muted-foreground tabular-nums">
            {`${selectedCount} de ${availableIds.length} selecionados`}
          </span>
        </label>
        <Button
          variant="subtle"
          size="sm"
          onClick={onClear}
          disabled={selectedCount === 0 || applying}
        >
          {clearLabel}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {applying && progress ? (
          <p role="status" className="text-xs text-muted-foreground tabular-nums">
            {`${progress.index} de ${progress.total}`}
          </p>
        ) : null}
        {failedItems.length > 0 ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
          >
            <Badge variant="destructive">{failedItems.length}</Badge>
            <p className="flex-1 text-xs text-destructive">{failureLabel(failedItems.length)}</p>
            <ul className="flex-1 text-xs text-destructive">
              {failedItems.map((item) => (
                <li key={getItemId(item)}>{getItemName(item)}</li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={onDismissFailures}>
              Fechar
            </Button>
          </div>
        ) : null}
        <Button
          size="sm"
          onClick={() => onApply(selectedItems)}
          disabled={selectedCount === 0 || applying}
          className="gap-1.5"
        >
          {applying ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {applyingLabel}
            </>
          ) : (
            <>
              <Zap className="size-3.5" aria-hidden="true" />
              {applyLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
