import { Cpu, Smartphone } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui';
import { cn } from '../../lib/utils';

interface EmulatorInstance {
  id: string;
  name: string;
  arch: string;
  displayName?: string;
}

interface InstanceSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: EmulatorInstance[];
  loading: boolean;
  onSelect: (instance: EmulatorInstance) => void;
}

export function InstanceSelectionModal({
  open,
  onOpenChange,
  instances,
  loading,
  onSelect,
}: InstanceSelectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione a versão do android</DialogTitle>
          <p className="text-sm text-muted-foreground">Instâncias</p>
        </DialogHeader>
        <div className="grid gap-3 pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Detectando instâncias…</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma instância encontrada. Crie uma instância no gerenciador do BlueStacks.
            </p>
          ) : (
            instances.map((instance) => (
              <Button
                key={instance.id}
                variant="outline"
                className={cn(
                  'flex items-center justify-start gap-3 h-auto py-4 px-4',
                  'hover:border-primary/50 hover:bg-primary/5 transition-[color,background-color,border-color,box-shadow,opacity] duration-200'
                )}
                onClick={() => {
                  onSelect(instance);
                  onOpenChange(false);
                }}
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="size-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold">{instance.displayName || instance.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Cpu className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{instance.arch}</span>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
