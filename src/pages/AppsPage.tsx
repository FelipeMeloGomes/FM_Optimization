import {
  AlertTriangle,
  MessageCircle,
  Music,
  Play,
  Shield,
  Smartphone,
  Square,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScriptBadge } from '../components/ScriptBadge';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { Badge, Button } from '../components/ui';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
import { useScriptPage } from '../hooks/use-script-page';
import { cn } from '../lib/utils';

interface AppSection {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  scriptIds: string[];
  warning?: string;
}

const APP_SECTIONS: AppSection[] = [
  {
    id: 'privacy',
    name: 'Privacidade',
    description: 'Maximize sua privacidade desativando telemetria e coleta de dados do Windows.',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    scriptIds: ['apps-1'],
  },
  {
    id: 'security',
    name: 'Segurança',
    description: 'Configurações de segurança do Windows para proteger seu sistema.',
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    scriptIds: ['apps-2'],
  },
  {
    id: 'debloat',
    name: 'Remover Bloatware',
    description: 'Remova aplicativos desnecessários pré-instalados no Windows.',
    icon: Trash2,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    scriptIds: ['apps-3', 'builtin-14'],
    warning: 'Alguns apps do sistema podem ser removidos. Use com cautela.',
  },
  {
    id: 'discord',
    name: 'Discord',
    description:
      'Instale o Equicord com o plugin FakeNitro para desbloquear emotes, stickers e uploads maiores. Inclui opção de reverter.',
    icon: MessageCircle,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    scriptIds: ['apps-4', 'apps-5'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description:
      'Debloat do Spotify com Spicetify: bloqueador de anúncios, Marketplace de temas e customização completa. Inclui opção de reverter.',
    icon: Music,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    scriptIds: ['apps-6', 'apps-7'],
    warning: 'Não funciona com o Spotify da Microsoft Store. Instale a versão desktop.',
  },
];

function AppSectionCard({
  section,
  scripts,
  activeExecution,
  onCancel,
  onConfirmExecute,
}: {
  section: AppSection;
  scripts: ScriptEntry[];
  activeExecution: string | null;
  onCancel: (id: string) => void;
  onConfirmExecute: (script: ScriptEntry) => void;
}) {
  const Icon = section.icon;
  const isScriptApplied = useIsScriptApplied();

  const sectionScripts = useMemo(
    () => scripts.filter((s) => section.scriptIds.includes(s.id)),
    [scripts, section.scriptIds]
  );

  const isAnyExecuting = section.scriptIds.some((id) => activeExecution === id);

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-300 hover:shadow-lg overflow-hidden',
        section.borderColor,
        isAnyExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-10 items-center justify-center rounded-lg', section.bgColor)}
            >
              <Icon className={cn('size-5', section.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{section.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {sectionScripts.length} tweaks
          </Badge>
        </div>

        {section.warning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
            <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-400/80 leading-relaxed">{section.warning}</p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {sectionScripts.map((script) => {
            const isScriptExecuting = activeExecution === script.id;
            return (
              <div
                key={script.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-background p-3 transition-all',
                  script.requiresAdmin && 'border-yellow-500/20',
                  isScriptExecuting && 'ring-2 ring-primary/50'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{script.name}</p>
                    <ScriptBadge script={script} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {script.description}
                  </p>
                </div>
                <Button
                  variant={isScriptExecuting ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    isScriptExecuting ? onCancel(script.id) : onConfirmExecute(script)
                  }
                  className="gap-1.5 shrink-0"
                >
                  {isScriptExecuting ? (
                    <>
                      <Square className="size-3" />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Play className="size-3" />
                      {isScriptApplied(script) ? 'Executar novamente' : 'Executar'}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const {
    state,
    categoryScripts: appsScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage('Apps');

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar tweaks</p>
        <p className="text-xs text-destructive">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Smartphone className="size-28 text-primary" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Aplicativos
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Gerencie privacidade e bloatware</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Controle sua privacidade, reforce a segurança, remova aplicativos desnecessários e dê um
            debloat no Discord e no Spotify com um clique.
          </p>
        </div>
      </div>

      {/* App Sections */}
      {APP_SECTIONS.map((section) => (
        <AppSectionCard
          key={section.id}
          section={section}
          scripts={appsScripts}
          activeExecution={activeExecution}
          onCancel={handleCancel}
          onConfirmExecute={handleConfirmExecute}
        />
      ))}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmScript}
        onOpenChange={(open) => {
          if (!open) setConfirmScript(null);
        }}
        script={confirmScript}
        onConfirm={handleConfirm}
        isExecuting={!!confirmScript && activeExecution === confirmScript.id}
      />
    </div>
  );
}
