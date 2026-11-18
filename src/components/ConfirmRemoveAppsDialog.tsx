import { PackageX } from 'lucide-react';
import type { AppxPackageInfo } from '../../electron/shared/ipc-types';
import { Button, Dialog, DialogContent, DialogTitle } from './ui';

interface ConfirmRemoveAppsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: AppxPackageInfo[];
  onConfirm: () => void;
}

/**
 * Confirmação da remoção de apps Appx. O `ConfirmDialog` genérico é amarrado a
 * um `ScriptEntry`; aqui a decisão é sobre uma seleção do inventário.
 */
export function ConfirmRemoveAppsDialog({
  open,
  onOpenChange,
  apps,
  onConfirm,
}: ConfirmRemoveAppsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-destructive/10 to-transparent p-6">
          <DialogTitle className="text-base">Remover apps selecionados</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {apps.length === 1 ? '1 app selecionado' : `${apps.length} apps selecionados`}
          </p>
        </div>

        <div className="space-y-3 p-6">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto overscroll-contain rounded-lg bg-muted/50 p-3">
            {apps.map((app) => (
              <li key={app.familyName} className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">{app.displayName}</p>
                <p title={app.familyName} className="truncate text-[10px] text-muted-foreground">
                  {app.familyName}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A remoção não pode ser desfeita. Alguns apps podem ser reinstalados por atualizações do
            Windows — remova de novo se isso acontecer.
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
            <Button variant="destructive" size="sm" onClick={onConfirm} className="flex-1 gap-1.5">
              <PackageX className="size-3.5" aria-hidden="true" />
              Remover apps
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
