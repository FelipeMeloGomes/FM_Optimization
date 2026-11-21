import { Loader2, Zap } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { Badge, Button } from './ui';

export interface ScriptSelectionToolbarProps {
  availableIds: string[];
  selectedIds: Set<string>;
  selectedScripts: ScriptEntry[];
  onSelectAll: () => void;
  onClear: () => void;
  onApply: (scripts: ScriptEntry[]) => void;
  applying: boolean;
  progress: { index: number; total: number } | null;
  failedScripts: ScriptEntry[];
  onDismissFailures: () => void;
}

/**
 * Barra de seleção de tweaks no padrão da Limpeza: checkbox "Selecionar todos"
 * com contador, "Limpar seleção" como ação secundária e botão de aplicar com
 * estado de progresso e alerta de falhas.
 */
export function ScriptSelectionToolbar({
  availableIds,
  selectedIds,
  selectedScripts,
  onSelectAll,
  onClear,
  onApply,
  applying,
  progress,
  failedScripts,
  onDismissFailures,
}: ScriptSelectionToolbarProps) {
  const selectedCount = availableIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = availableIds.length > 0 && availableIds.every((id) => selectedIds.has(id));

  const handleApplyClick = () => {
    onApply(selectedScripts);
  };

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
        <label
          htmlFor="select-all-tweaks"
          className="flex items-center gap-2 text-sm text-foreground"
        >
          <input
            id="select-all-tweaks"
            type="checkbox"
            className="size-4 accent-primary"
            checked={allSelected}
            onChange={handleSelectAllClick}
            disabled={availableIds.length === 0 || applying}
          />
          Selecionar todos
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
          Limpar seleção
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {applying && progress ? (
          <p role="status" className="text-xs text-muted-foreground tabular-nums">
            {`${progress.index} de ${progress.total}`}
          </p>
        ) : null}
        {failedScripts.length > 0 ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
          >
            <Badge variant="destructive">{failedScripts.length}</Badge>
            <p className="flex-1 text-xs text-destructive">
              {failedScripts.length === 1 ? 'Falhou o tweak' : 'Falharam os tweaks'}
            </p>
            <ul className="flex-1 text-xs text-destructive">
              {failedScripts.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={onDismissFailures}>
              Fechar
            </Button>
          </div>
        ) : null}
        <Button
          size="sm"
          onClick={handleApplyClick}
          disabled={selectedCount === 0 || applying}
          className="gap-1.5"
        >
          {applying ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Aplicando…
            </>
          ) : (
            <>
              <Zap className="size-3.5" aria-hidden="true" />
              Aplicar selecionados
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
