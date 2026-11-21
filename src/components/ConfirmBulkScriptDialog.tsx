import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { Button, Dialog, DialogContent, DialogTitle } from './ui';

export interface ConfirmBulkScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scripts: ScriptEntry[];
  onConfirm: () => void;
}

/**
 * Confirmação da aplicação em lote: lista os tweaks selecionados, avisa sobre
 * scripts interativos e só dispara a aplicação no botão explícito.
 */
export function ConfirmBulkScriptDialog({
  open,
  onOpenChange,
  scripts,
  onConfirm,
}: ConfirmBulkScriptDialogProps) {
  const actionLabel = `Aplicar ${scripts.length} ${scripts.length === 1 ? 'tweak' : 'tweaks'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-primary/10 to-transparent p-6">
          <DialogTitle className="text-base">Confirmar aplicação</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {scripts.length === 1 ? '1 tweak selecionado' : `${scripts.length} tweaks selecionados`}
          </p>
        </div>

        <div className="space-y-3 p-6">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto overscroll-contain rounded-lg bg-muted/50 p-3">
            {scripts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{s.name}</span>
              </li>
            ))}
          </ul>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {`Os ${scripts.length} ${scripts.length === 1 ? 'tweak' : 'tweaks'} abaixo serão aplicados em sequência.`}
          </p>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Scripts interativos abrem uma janela e só terminam quando você a fechar.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={onConfirm} className="flex-1 gap-1.5">
              {actionLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
