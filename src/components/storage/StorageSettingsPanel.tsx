import type { StorageDrive } from '../../../electron/shared/ipc-types';
import { useStorageDrives } from '../../hooks/use-storage-drives';
import { cn } from '../../lib/utils';
import { AnimatedNumber, Badge, Button, Progress, SettingsPreviewLayout } from '../ui';

const DRIVE_MEDIA_TYPES = new Set(['SSD NVMe', 'SSD', 'HD']);

function driveBarClass(usedPercent: number): string {
  if (usedPercent < 70) return '[&>div]:bg-success';
  if (usedPercent < 90) return '[&>div]:bg-warning';
  return '[&>div]:bg-destructive';
}

interface DiskCardProps {
  drive: StorageDrive;
  selected: boolean;
  optimize: boolean;
  busy: boolean;
  error?: string;
  applied: boolean;
  onToggleSelected: () => void;
  onToggleOptimize: () => void;
  onCleanup: () => void;
  onOptimize: () => void;
}

function DiskCard({
  drive,
  selected,
  optimize,
  busy,
  error,
  applied,
  onToggleSelected,
  onToggleOptimize,
  onCleanup,
  onOptimize,
}: DiskCardProps) {
  const isSolidState = drive.type.startsWith('SSD');
  const badge = DRIVE_MEDIA_TYPES.has(drive.type) ? drive.type : undefined;

  return (
    <div
      data-drive-letter={drive.letter}
      className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-primary" />
        <h4 className="text-sm font-semibold text-foreground">Disco {drive.letter}</h4>
        {drive.label && <span className="text-xs text-muted-foreground">· {drive.label}</span>}
        {badge && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {badge}
          </Badge>
        )}
      </div>

      <SettingsPreviewLayout
        preview={
          <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/40 p-3">
            <div className="relative h-12 w-20 shrink-0 rounded border-2 border-primary/40 bg-background">
              <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-primary/20 to-transparent" />
              <div className="absolute bottom-1 right-1 size-1.5 rounded-full bg-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground tabular-nums leading-tight">
                <AnimatedNumber value={drive.usedPercent} suffix="%" />
              </p>
              <p className="truncate text-xs text-muted-foreground">{drive.size}</p>
              <p className="truncate text-xs text-primary">{drive.free} livres</p>
            </div>
          </div>
        }
        footer={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy} onClick={onCleanup}>
                Limpeza de disco
              </Button>
              {isSolidState && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={onOptimize}>
                  Otimizar SSD
                </Button>
              )}
              {applied && <span className="text-xs text-primary">Concluído</span>}
            </div>
            {error && (
              <p className="mt-2 text-xs text-destructive">Não foi possível concluir: {error}</p>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label
            htmlFor={`storage-select-${drive.letter}`}
            className="flex items-center gap-2 text-xs font-medium text-foreground"
          >
            <input
              id={`storage-select-${drive.letter}`}
              type="checkbox"
              aria-label={`Selecionar Disco ${drive.letter}`}
              checked={selected}
              onChange={onToggleSelected}
              className="size-4 rounded border-border accent-primary"
            />
            Selecionar para limpeza
          </label>

          {isSolidState && (
            <label
              htmlFor={`storage-optimize-${drive.letter}`}
              className="flex items-center gap-2 text-xs font-medium text-foreground"
            >
              <input
                id={`storage-optimize-${drive.letter}`}
                type="checkbox"
                aria-label="Incluir otimização SSD (TRIM)"
                checked={optimize}
                onChange={onToggleOptimize}
                className="size-4 rounded border-border accent-primary"
              />
              Incluir otimização SSD (TRIM)
            </label>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Uso</span>
              <span className="tabular-nums">{drive.usedPercent}%</span>
            </div>
            <Progress
              value={drive.usedPercent}
              ariaLabel={`Disco ${drive.letter}: ${drive.usedPercent}%`}
              className={cn('h-1.5', driveBarClass(drive.usedPercent))}
            />
          </div>
        </div>
      </SettingsPreviewLayout>
    </div>
  );
}

/** Cards por unidade, no mesmo padrão de prévia/controles do Monitor. */
export function StorageSettingsPanel() {
  const {
    state,
    drives,
    selected,
    optimizeFlags,
    busy,
    errors,
    applied,
    refresh,
    toggleSelected,
    toggleOptimize,
    cleanup,
    optimize,
    cleanupSelected,
  } = useStorageDrives();

  if (state.status === 'loading') {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-semibold text-destructive">Erro ao carregar unidades</p>
        <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
        <Button size="sm" className="mt-3" onClick={refresh}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (drives.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada</p>
        <Button size="sm" className="mt-3" onClick={refresh}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Ajustes do Windows</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          Por disco
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
        <p className="text-xs text-muted-foreground">
          {selected.size === 0
            ? 'Nenhuma unidade selecionada'
            : `${selected.size} ${selected.size === 1 ? 'unidade selecionada' : 'unidades selecionadas'}`}
        </p>
        <Button size="sm" disabled={selected.size === 0} onClick={() => void cleanupSelected()}>
          Executar limpeza nos selecionados
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {drives.map((drive) => (
          <DiskCard
            key={drive.letter}
            drive={drive}
            selected={selected.has(drive.letter)}
            optimize={optimizeFlags.has(drive.letter)}
            busy={busy.has(drive.letter)}
            error={errors[drive.letter]}
            applied={applied[drive.letter] === true}
            onToggleSelected={() => toggleSelected(drive.letter)}
            onToggleOptimize={() => toggleOptimize(drive.letter)}
            onCleanup={() => void cleanup(drive.letter)}
            onOptimize={() => void optimize(drive.letter)}
          />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        A limpeza e a otimização abrem ferramentas do Windows e exigem privilégios de administrador
      </p>
    </section>
  );
}
