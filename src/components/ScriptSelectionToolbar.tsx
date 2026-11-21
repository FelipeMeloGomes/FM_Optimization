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
 * Barra de seleção de tweaks: contador da seleção visível, botão
 * "Selecionar todos"/"Limpar seleção", botão "Aplicar selecionados" (desabilitado
 * com zero selecionados ou com o lote em andamento) e alerta de falhas.
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
        <Button variant="ghost" size="sm" onClick={handleSelectAllClick} className="gap-1.5">
          {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {`${selectedCount} de ${availableIds.length} selecionados`}
        </span>
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
          Aplicar selecionados
        </Button>
      </div>
    </div>
  );
}
