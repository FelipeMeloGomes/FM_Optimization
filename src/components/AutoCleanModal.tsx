import { CalendarClock, Loader2, Play, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { AutoCleanSettings } from '../../electron/shared/ipc-types';
import { useAutoCleanContext } from '../contexts/AutoCleanContext';
import { CLEANER_OPTIONS, formatNextRun } from '../lib/cleaner-options';
import { cn } from '../lib/utils';
import { Button } from './ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Toggle } from './ui/Toggle';

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

function frequencyLabel(frequency: AutoCleanSettings['frequency']): string {
  return frequency === 'daily' ? 'Todo dia' : frequency === 'weekly' ? 'Semanal' : 'Mensal';
}

export function AutoCleanModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { status, updateConfig, runNow, runPending, discard, relaunchAsAdmin } =
    useAutoCleanContext();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const settings = status?.settings;
  const selected = new Set(settings?.cleaners ?? []);
  const pending = settings?.pending ?? [];
  const isAdmin = status?.isAdmin ?? false;
  const running = status?.running ?? false;

  const toggleCleaner = useCallback(
    (id: string) => {
      if (!settings) return;
      const next = new Set(settings.cleaners);
      if (next.has(id)) {
        if (next.size === 1) return; // nunca deixa a seleção vazia
        next.delete(id);
      } else {
        next.add(id);
      }
      updateConfig({ cleaners: CLEANER_OPTIONS.filter((o) => next.has(o.id)).map((o) => o.id) });
    },
    [settings, updateConfig]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-lg border-border bg-card p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Limpeza automática
          </DialogTitle>
          <DialogDescription>
            Agende limpezas para rodar enquanto o app está na bandeja.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {!settings ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="rounded-lg border border-border bg-background/40 p-4">
                <Toggle
                  id="auto-clean-enabled"
                  label="Ativar limpeza automática"
                  description="Mantém o app na bandeja para executar no horário"
                  checked={settings.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                />
              </div>

              <fieldset
                className={cn('space-y-2', !settings.enabled && 'pointer-events-none opacity-50')}
                disabled={!settings.enabled}
              >
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  O que limpar
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CLEANER_OPTIONS.map((option) => {
                    const isSelected = selected.has(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleCleaner(option.id)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border bg-background/40 hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{option.name}</span>
                          <span
                            className={cn(
                              'size-3.5 shrink-0 rounded-full border',
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/50'
                            )}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {option.description}
                        </p>
                        {option.requiresAdmin && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                            <ShieldAlert className="size-2.5" aria-hidden="true" />
                            requer admin
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset
                className={cn(
                  'space-y-3 rounded-lg border border-border bg-background/40 p-4',
                  !settings.enabled && 'opacity-50'
                )}
                disabled={!settings.enabled}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="auto-clean-frequency"
                      className="mb-1 block text-xs font-medium text-foreground"
                    >
                      Frequência
                    </label>
                    <select
                      id="auto-clean-frequency"
                      value={settings.frequency}
                      onChange={(e) =>
                        updateConfig({
                          frequency: e.target.value as AutoCleanSettings['frequency'],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    >
                      <option value="daily">{frequencyLabel('daily')}</option>
                      <option value="weekly">{frequencyLabel('weekly')}</option>
                      <option value="monthly">{frequencyLabel('monthly')}</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="auto-clean-time"
                      className="mb-1 block text-xs font-medium text-foreground"
                    >
                      Horário
                    </label>
                    <input
                      id="auto-clean-time"
                      type="time"
                      value={settings.time}
                      onChange={(e) => updateConfig({ time: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>

                  {settings.frequency === 'weekly' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="auto-clean-weekday"
                        className="mb-1 block text-xs font-medium text-foreground"
                      >
                        Dia da semana
                      </label>
                      <select
                        id="auto-clean-weekday"
                        value={settings.weekday ?? 0}
                        onChange={(e) => updateConfig({ weekday: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      >
                        {WEEKDAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {settings.frequency === 'monthly' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="auto-clean-day"
                        className="mb-1 block text-xs font-medium text-foreground"
                      >
                        Dia do mês
                      </label>
                      <select
                        id="auto-clean-day"
                        value={settings.dayOfMonth ?? 1}
                        onChange={(e) => updateConfig({ dayOfMonth: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            Dia {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-3">
                  <Toggle
                    id="auto-clean-startup"
                    label="Iniciar com o Windows"
                    description="Abre direto na bandeja"
                    checked={settings.runOnStartup}
                    onChange={(e) => updateConfig({ runOnStartup: e.target.checked })}
                  />
                  <Toggle
                    id="auto-clean-catchup"
                    label="Executar ao abrir se estiver atrasado"
                    description="Se o PC estava desligado no horário, roda na próxima abertura"
                    checked={settings.catchUp}
                    onChange={(e) => updateConfig({ catchUp: e.target.checked })}
                  />
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
                <span className="text-muted-foreground">Status:</span>
                {settings.enabled ? (
                  <span className="font-medium text-foreground">
                    {settings.nextRunAt === null
                      ? 'calculando…'
                      : `próxima ${formatNextRun(settings.nextRunAt)}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">desativada</span>
                )}
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-green-400 sm:ml-auto">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 sm:ml-auto">
                    <ShieldAlert className="size-3" aria-hidden="true" />
                    sem admin
                  </span>
                )}
                {!isAdmin && settings.enabled && pending.length === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void relaunchAsAdmin()}
                    className="h-6 gap-1 px-2 text-[11px]"
                  >
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    Reiniciar como admin
                  </Button>
                )}
              </div>

              {pending.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-400">
                    {pending.length} limpeza(s) aguardando administrador
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {pending.map((id) => (
                      <li key={id}>
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-background/50 py-0.5 pl-1.5 pr-0.5 text-[11px] text-foreground">
                          {CLEANER_OPTIONS.find((o) => o.id === id)?.name ?? id}
                          <button
                            type="button"
                            aria-label={`Descartar pendência de ${
                              CLEANER_OPTIONS.find((o) => o.id === id)?.name ?? id
                            }`}
                            onClick={() => void discard([id])}
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => void runPending()}
                      disabled={running}
                      className="gap-1.5"
                    >
                      <Play className="size-3" aria-hidden="true" />
                      Executar pendências
                    </Button>
                    {!isAdmin && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void relaunchAsAdmin()}
                        className="gap-1.5"
                      >
                        <ShieldCheck className="size-3" aria-hidden="true" />
                        Reiniciar como admin
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={confirmDiscard ? 'destructive' : 'ghost'}
                      onClick={() => {
                        if (confirmDiscard) {
                          void discard(pending);
                          setConfirmDiscard(false);
                          return;
                        }
                        setConfirmDiscard(true);
                      }}
                      onBlur={() => setConfirmDiscard(false)}
                    >
                      {confirmDiscard ? 'Confirmar descarte' : 'Descartar todas'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {settings && (
          <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runNow(settings.cleaners)}
                disabled={running || settings.cleaners.length === 0}
                className="h-9 w-full gap-1.5 sm:w-auto"
              >
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-3.5" aria-hidden="true" />
                )}
                {running ? 'Executando…' : 'Executar agora'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 w-full sm:w-auto"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
