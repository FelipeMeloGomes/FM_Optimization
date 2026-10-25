import {
  AlertTriangle,
  Cpu,
  ExternalLink,
  FileArchive,
  FolderArchive,
  Gauge,
  type LucideIcon,
  MonitorDown,
  PackageCheck,
  PackageX,
  Square,
  Thermometer,
} from 'lucide-react';
import type {
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
} from '../../electron/shared/ipc-types';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { Badge, Button, Progress } from '../components/ui';
import { useEssentials } from '../hooks/use-essentials';
import { cn } from '../lib/utils';

interface ProgramStyle {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PROGRAM_STYLES: Record<string, ProgramStyle> = {
  'cpu-z': {
    icon: Cpu,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  hwmonitor: {
    icon: Thermometer,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  'msi-afterburner': {
    icon: Gauge,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
  },
  '7-zip': {
    icon: FolderArchive,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  winrar: {
    icon: FileArchive,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
  },
  bcuninstaller: {
    icon: PackageX,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
};

const FALLBACK_STYLE: ProgramStyle = {
  icon: MonitorDown,
  color: 'text-primary',
  bgColor: 'bg-primary/10',
  borderColor: 'border-primary/20',
};

function EssentialCard({
  item,
  installProgress,
  installed,
  error,
  isRunning,
  onInstall,
  onCancelInstall,
  onOpenPage,
}: {
  item: EssentialListItem;
  installProgress?: EssentialInstallProgress;
  installed?: EssentialInstallResult;
  error?: string;
  isRunning: boolean;
  onInstall: () => void;
  onCancelInstall: () => void;
  onOpenPage: () => void;
}) {
  const style = PROGRAM_STYLES[item.id] ?? FALLBACK_STYLE;
  const Icon = style.icon;
  const installPercent = installProgress?.percent ?? null;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-300 hover:shadow-lg overflow-hidden',
        style.borderColor,
        isRunning && 'ring-2 ring-primary/50'
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-10 items-center justify-center rounded-lg', style.bgColor)}
            >
              <Icon className={cn('size-5', style.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{item.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
            {item.packageId}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>Instalado pelo winget</span>
          <span aria-hidden="true">·</span>
          <span>hash do manifesto verificado</span>
        </div>

        {item.warning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
            <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-400/80 leading-relaxed">{item.warning}</p>
          </div>
        )}

        {isRunning && (
          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {installProgress?.status === 'installing'
                  ? 'Instalando...'
                  : installProgress?.status === 'downloading'
                    ? 'Baixando pelo winget...'
                    : 'Iniciando o winget...'}
              </span>
              <span>{installPercent === null ? 'aguarde' : `${installPercent}%`}</span>
            </div>
            <Progress
              value={installPercent ?? 0}
              className={cn('mt-2 h-1.5', installPercent === null && 'animate-pulse')}
            />
          </div>
        )}

        {installed && !isRunning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3">
            <PackageCheck className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-emerald-400/80 leading-relaxed">
              {installed.alreadyInstalled
                ? 'O winget confirmou que este programa já está instalado.'
                : 'Instalado pelo winget neste PC.'}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/10 bg-red-500/5 p-3">
            <AlertTriangle className="size-3.5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-400/80 leading-relaxed">{error}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={onCancelInstall} className="gap-1.5">
              <Square className="size-3" />
              Cancelar
            </Button>
          ) : (
            <Button size="sm" onClick={onInstall} className="gap-1.5">
              <PackageCheck className="size-3" />
              Instalar
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onOpenPage} className="gap-1.5">
            <ExternalLink className="size-3" />
            Página oficial
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EssentialsPage() {
  const {
    state,
    reload,
    installProgress,
    installs,
    errors,
    running,
    install,
    cancelInstall,
    openPage,
  } = useEssentials();

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <ScriptCardSkeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, fixed count
              key={`skeleton-${i}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar os programas essenciais</p>
        <p className="text-xs text-destructive">{state.error}</p>
        <Button variant="secondary" size="sm" onClick={reload}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <MonitorDown className="size-28 text-primary" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <MonitorDown className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Essenciais PC
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">App Essenciais PC</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Utilitários para diagnosticar, monitorar, ajustar, compactar e desinstalar programas no
            PC. Todos são instalados pelo winget, que baixa do canal oficial do fornecedor e confere
            o hash do manifesto antes de rodar.
          </p>
        </div>
      </div>

      {/* Programas */}
      {state.data.map((item) => (
        <EssentialCard
          key={item.id}
          item={item}
          installProgress={installProgress[item.id]}
          installed={installs[item.id]}
          error={errors[item.id]}
          isRunning={running[item.id] === true}
          onInstall={() => install(item)}
          onCancelInstall={() => cancelInstall(item.id)}
          onOpenPage={() => openPage(item)}
        />
      ))}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Nada é executado sozinho: cada programa só é instalado depois do clique em Instalar, e o
        winget confere o hash do manifesto antes de rodar o instalador. Se o hash não bater, a
        instalação é abortada.
      </p>
    </div>
  );
}
