import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RISK_STYLES } from '../components/ScriptCard';
import { cn } from '../lib/utils';
import { Badge, Button, Dialog, DialogContent, DialogTitle } from './ui';

interface ConfirmDialogItem {
  name: string;
  description: string;
  extension?: string;
  requiresAdmin?: boolean;
  requiresRestart?: boolean;
  interactive?: boolean;
  riskLevel?: 'safe' | 'moderate' | 'deep';
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: ConfirmDialogItem | null;
  onConfirm: () => void;
  isExecuting: boolean;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  script,
  onConfirm,
  isExecuting,
}: ConfirmDialogProps) {
  const [phase, setPhase] = useState<'confirm' | 'executing' | 'done'>('confirm');
  const wasExecuting = useRef(false);
  const startTime = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (wasExecuting.current && !isExecuting) {
      setElapsed(Date.now() - startTime.current);
      setPhase('done');
    }
    wasExecuting.current = isExecuting;
  }, [isExecuting]);

  useEffect(() => {
    if (phase !== 'executing') return;
    const id = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!open) {
      setPhase('confirm');
      setElapsed(0);
      wasExecuting.current = false;
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    startTime.current = Date.now();
    setElapsed(0);
    setPhase('executing');
    onConfirm();
  }, [onConfirm]);

  if (!script) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'relative p-6 pb-4 transition-colors duration-500',
            phase === 'confirm' && 'bg-gradient-to-br from-primary/10 to-transparent',
            phase === 'executing' && 'bg-gradient-to-br from-primary/15 to-primary/5',
            phase === 'done' && 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-xl transition-colors duration-500',
                phase === 'confirm' && 'bg-primary/10',
                phase === 'executing' && 'bg-primary/20',
                phase === 'done' && 'bg-emerald-500/20'
              )}
            >
              {phase === 'executing' ? (
                <Loader2 className="size-5 text-primary animate-spin" />
              ) : phase === 'done' ? (
                <CheckCircle2 className="size-5 text-emerald-400" />
              ) : (
                <Play className="size-5 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base">
                {phase === 'executing'
                  ? 'Executando...'
                  : phase === 'done'
                    ? 'Concluído'
                    : 'Confirmar Execução'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {phase === 'executing'
                  ? 'Script em execução'
                  : phase === 'done'
                    ? `Finalizado em ${formatElapsed(elapsed)}`
                    : 'Confirme a execução'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Script info */}
          <div className="rounded-lg bg-muted/50 p-3 mb-4">
            <p className="text-sm font-semibold text-foreground mb-2">{script.name}</p>
            {/* Every chip is mono, not just the `.ext` one: see ScriptBadge. */}
            <div className="flex flex-wrap gap-1.5">
              {script.extension && (
                <Badge variant="secondary" className="gap-1 font-mono text-[10px] px-1.5 py-0">
                  <Terminal className="size-3" />.{script.extension}
                </Badge>
              )}
              {script.requiresAdmin && (
                <Badge variant="destructive" className="gap-1 font-mono text-[10px] px-1.5 py-0">
                  <Shield className="size-3" />
                  Admin
                </Badge>
              )}
              {script.requiresRestart && (
                <Badge
                  variant="outline"
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400"
                >
                  <RotateCcw className="size-3" />
                  Reiniciar
                </Badge>
              )}
              {script.interactive && (
                <Badge
                  variant="outline"
                  className="gap-1 font-mono text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-400"
                >
                  <Terminal className="size-3" />
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

          <p className="text-[13px] leading-relaxed text-muted-foreground mb-4">
            {script.description}
          </p>

          {/* Warnings — confirm phase only */}
          {phase === 'confirm' && script.requiresAdmin && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 mb-3">
              <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-400/80">Requer privilégios de administrador.</p>
            </div>
          )}

          {phase === 'confirm' && script.requiresRestart && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 mb-3">
              <RotateCcw className="size-3.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-400/80">Requer reinício do PC após execução.</p>
            </div>
          )}

          {phase === 'confirm' && script.interactive && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 mb-3">
              <Terminal className="size-3.5 text-blue-400 shrink-0" />
              <p className="text-[11px] text-blue-400/80">
                Script interativo — uma janela do CMD será aberta para inputs.
              </p>
            </div>
          )}

          {/* Executing phase — live timer */}
          {phase === 'executing' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex size-8 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-primary/30" />
                  <span className="absolute text-[10px] font-mono font-bold text-primary">
                    {formatElapsed(elapsed)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">Executando script</p>
                  <p className="text-[11px] text-muted-foreground">Não feche esta janela</p>
                </div>
              </div>
            </div>
          )}

          {/* Done phase — summary */}
          {phase === 'done' && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-emerald-400">Executado com sucesso</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="size-3 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">
                      Tempo: {formatElapsed(elapsed)}
                    </p>
                  </div>
                </div>
              </div>
              {script.requiresRestart && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/10 p-2">
                  <RotateCcw className="size-3 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-amber-400/80">
                    Reinicie o PC para aplicar as mudanças.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {phase === 'confirm' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="flex-1 gap-1.5 shadow-[0_0_15px_rgba(0,68,255,0.3)] hover:shadow-[0_0_20px_rgba(0,68,255,0.5)]"
              >
                <Play className="size-3.5" />
                Executar
              </Button>
            </div>
          )}

          {phase === 'executing' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Fechar
            </Button>
          )}

          {phase === 'done' && (
            <Button size="sm" onClick={() => onOpenChange(false)} className="w-full gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
