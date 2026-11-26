import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { BulkSelectionToolbar } from './BulkSelectionToolbar';

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

/** Barra de seleção de tweaks sobre a barra genérica de ações em lote. */
export function ScriptSelectionToolbar(props: ScriptSelectionToolbarProps) {
  return (
    <BulkSelectionToolbar<ScriptEntry>
      availableIds={props.availableIds}
      selectedIds={props.selectedIds}
      selectedItems={props.selectedScripts}
      onSelectAll={props.onSelectAll}
      onClear={props.onClear}
      onApply={props.onApply}
      applying={props.applying}
      progress={props.progress}
      failedItems={props.failedScripts}
      onDismissFailures={props.onDismissFailures}
      getItemId={(script) => script.id}
      getItemName={(script) => script.name}
    />
  );
}
