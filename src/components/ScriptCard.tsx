import {
  Cpu,
  Eraser,
  Gauge,
  MousePointerClick,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Smartphone,
  Square,
  Terminal,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useSettingsContext } from '../contexts/SettingsContext';
import { cn } from '../lib/utils';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from './ui';

export const RISK_STYLES: Record<string, { className: string; label: string }> = {
  safe: { className: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Seguro' },
  moderate: {
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    label: 'Moderado',
  },
  deep: { className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Completo' },
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
  Tweaks: {
    icon: Gauge,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  Utilities: {
    icon: Wrench,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  Cleaner: {
    icon: Eraser,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  Apps: {
    icon: Smartphone,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
  },
  Internet: {
    icon: Wifi,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  'Input Lag': {
    icon: MousePointerClick,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
  },
  CPU: {
    icon: Cpu,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
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
        'group relative rounded-xl border bg-card p-5 transition-all duration-300 hover:shadow-lg',
        config.borderColor,
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
            <span className="font-semibold text-foreground truncate block">{script.name}</span>
            {/* Every chip is mono, not just the `.ext` one: see ScriptBadge. */}
            <div className="flex items-center gap-2 mt-1">
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
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  Reiniciar
                </Badge>
              )}
              {script.interactive && (
                <Badge
                  variant="outline"
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-400"
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
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{script.description}</p>

      {script.requiresAdmin && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-yellow-400/80">
          <Shield className="size-3" />
          <span>Requer administrador</span>
        </div>
      )}

      {script.requiresRestart && (
        <div
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-400/80"
        >
          <RotateCcw className="size-3" />
          <span>Requer reinício do PC após execução</span>
        </div>
      )}

      {script.interactive && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-blue-400/80">
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
            aria-label="Executar script"
          >
            <Play className="size-3.5" aria-hidden="true" />
            Executar
          </Button>
        )}
      </div>

      {showRestartPrompt && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Reinício necessário</p>
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
                    className="gap-1 font-mono text-xs border-amber-500/50 text-amber-400"
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    Reiniciar
                  </Badge>
                )}
                {script.interactive && (
                  <Badge
                    variant="outline"
                    className="gap-1 font-mono text-xs border-blue-500/50 text-blue-400"
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
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                <RotateCcw className="size-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400 font-medium">
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
