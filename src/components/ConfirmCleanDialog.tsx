import { Trash2 } from 'lucide-react';
import type { CleanerItemStats } from '../../electron/shared/ipc-types';
import { formatBytes } from '../utils/format';
import { Button, Dialog, DialogContent, DialogTitle } from './ui';

interface ConfirmCleanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CleanerItemStats[];
  totalBytes: number;
  onConfirm: () => void;
}

/**
 * Confirmação da limpeza por itens. O `ConfirmDialog` existente é amarrado a um
 * `ScriptEntry` (extensão, risco, histórico); aqui a decisão é sobre uma
 * seleção de pastas, então o conteúdo é outro.
 */
export function ConfirmCleanDialog({
  open,
  onOpenChange,
  items,
  totalBytes,
  onConfirm,
}: ConfirmCleanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-primary/10 to-transparent p-6">
          <DialogTitle className="text-base">Confirmar limpeza</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length === 1 ? '1 item selecionado' : `${items.length} itens selecionados`}
          </p>
        </div>

        <div className="space-y-3 p-6">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto overscroll-contain rounded-lg bg-muted/50 p-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium tabular-nums">{formatBytes(item.totalSizeBytes)}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="font-medium text-foreground">Total a liberar</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatBytes(totalBytes)}
            </span>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Os arquivos são apagados direto do disco — não é possível desfazer.
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
              <Trash2 className="size-3.5" aria-hidden="true" />
              Limpar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
