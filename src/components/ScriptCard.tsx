import {
  CheckCircle2,
  Cpu,
  Eraser,
  Monitor,
  MousePointerClick,
  PackageX,
  Palette,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Terminal,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useIsScriptApplied } from '../hooks/use-is-script-applied';
import { cn } from '../lib/utils';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from './ui';

export const RISK_STYLES: Record<string, { className: string; label: string }> = {
  safe: { className: 'bg-success/20 text-success border-success/30', label: 'Seguro' },
  moderate: {
    className: 'bg-warning/20 text-warning border-warning/30',
    label: 'Moderado',
  },
  deep: {
    className: 'bg-destructive/20 text-destructive border-destructive/30',
    label: 'Completo',
  },
};

interface ScriptCardProps {
  script: ScriptEntry;
  isExecuting: boolean;
  onExecute: () => void;
  onCancel: () => void;
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  Utilities: {
    icon: Wrench,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
  Cleaner: {
    icon: Eraser,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  Debloat: {
    icon: PackageX,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  Segurança: {
    icon: ShieldCheck,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  Internet: {
    icon: Wifi,
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
  },
  'Input Lag': {
    icon: MousePointerClick,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  CPU: {
    icon: Cpu,
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
  },
  GPU: {
    icon: Monitor,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
  Windows: {
    icon: SlidersHorizontal,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  Personalização: {
    icon: Palette,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
};

const DEFAULT_CONFIG = {
  icon: Zap,
  color: 'text-primary',
  bgColor: 'bg-primary/10',
  borderColor: 'border-primary/20',
};

export const ScriptCard = memo(function ScriptCard({
  script,
  isExecuting,
  onExecute,
  onCancel,
}: ScriptCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const wasExecuting = useRef(false);
  const { settings } = useSettingsContext();
  const isScriptApplied = useIsScriptApplied();
  const isApplied = isScriptApplied(script);

  useEffect(() => {
    if (wasExecuting.current && !isExecuting && script.requiresRestart) {
      setShowRestartPrompt(true);
    }
    wasExecuting.current = isExecuting;
  }, [isExecuting, script.requiresRestart]);

  const config = CATEGORY_CONFIG[script.category] || DEFAULT_CONFIG;
  const Icon = config.icon;

  function handleExecute() {
    if (settings.confirmOnExecute) {
      setShowConfirm(true);
    } else {
      onExecute();
    }
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-5 transition-[color,background-color,border-color,box-shadow,opacity] duration-300 hover:shadow-lg',
        config.borderColor,
        isApplied && 'hover:border-success/40',
        isExecuting && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn('flex size-10 items-center justify-center rounded-lg', config.bgColor)}
          >
            <Icon className={cn('size-5', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <span title={script.name} className="block truncate font-semibold text-foreground">
              {script.name}
            </span>
            {/* Every chip is mono, not just the `.ext` one: see ScriptBadge. */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 font-mono text-[10px] px-1.5 py-0">
                <Terminal className="size-3" aria-hidden="true" />.{script.extension}
              </Badge>
              {script.requiresAdmin && (
                <Badge variant="destructive" className="gap-1 font-mono text-[10px] px-1.5 py-0">
                  <ShieldAlert className="size-3" aria-hidden="true" />
                  Admin
                </Badge>
              )}
              {script.requiresRestart && (
                <Badge
                  variant="outline"
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-warning/50 text-warning"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  Reiniciar
                </Badge>
              )}
              {script.interactive && (
                <Badge
                  variant="outline"
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-info/50 text-info"
                >
                  <Terminal className="size-3" aria-hidden="true" />
                  Interativo
                </Badge>
              )}
              {script.riskLevel && (
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1 font-mono text-[10px] px-1.5 py-0',
                    RISK_STYLES[script.riskLevel].className
                  )}
                >
                  {RISK_STYLES[script.riskLevel].label}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {isApplied && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Aplicado
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{script.description}</p>

      {script.requiresAdmin && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-warning">
          <Shield className="size-3" />
          <span>Requer administrador</span>
        </div>
      )}

      {script.requiresRestart && (
        <div aria-live="polite" className="mt-3 flex items-center gap-1.5 text-[10px] text-warning">
          <RotateCcw className="size-3" />
          <span>Requer reinício do PC após execução</span>
        </div>
      )}

      {script.interactive && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-info">
          <Terminal className="size-3" />
          <span>Script interativo — abrirá uma janela do CMD para inputs</span>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {isExecuting ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancel}
            className="flex-1 gap-2"
            aria-label="Cancelar execução"
          >
            <Square className="size-3.5" aria-hidden="true" />
            Cancelar
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            className="flex-1 gap-2"
            aria-label={isApplied ? 'Executar novamente' : 'Executar script'}
          >
            <Play className="size-3.5" aria-hidden="true" />
            {isApplied ? 'Executar novamente' : 'Executar'}
          </Button>
        )}
      </div>

      {showRestartPrompt && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">Reinício necessário</p>
              <p className="text-xs text-muted-foreground">
                As mudanças só terão efeito após reiniciar o PC.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRestartPrompt(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Entendi
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Execução</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{script.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1 font-mono text-xs">
                  <Terminal className="size-3" aria-hidden="true" />.{script.extension}
                </Badge>
                {script.requiresAdmin && (
                  <Badge variant="destructive" className="gap-1 font-mono text-xs">
                    <ShieldAlert className="size-3" aria-hidden="true" />
                    Admin
                  </Badge>
                )}
                {script.requiresRestart && (
                  <Badge
                    variant="outline"
                    className="gap-1 font-mono text-xs border-warning/50 text-warning"
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    Reiniciar
                  </Badge>
                )}
                {script.interactive && (
                  <Badge
                    variant="outline"
                    className="gap-1 font-mono text-xs border-info/50 text-info"
                  >
                    <Terminal className="size-3" aria-hidden="true" />
                    Interativo
                  </Badge>
                )}
                {script.riskLevel && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 font-mono text-xs',
                      RISK_STYLES[script.riskLevel].className
                    )}
                  >
                    {RISK_STYLES[script.riskLevel].label}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {script.description}
            </p>
            {script.requiresRestart && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
                <RotateCcw className="size-4 text-warning shrink-0" />
                <p className="text-xs text-warning font-medium">
                  Este script requer reinício do PC para que as mudanças tenham efeito.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowConfirm(false);
                  onExecute();
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
