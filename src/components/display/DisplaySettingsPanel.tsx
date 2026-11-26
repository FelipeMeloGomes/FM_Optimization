import { useMemo } from 'react';
import type { DisplayMode, DisplayMonitor } from '../../../electron/shared/display-settings';
import { useDisplaySettings } from '../../hooks/use-display-settings';
import { PageSkeleton } from '../PageSkeleton';
import { SettingsApplyFooter } from '../settings/SettingsApplyFooter';
import { SettingsPanelShell } from '../settings/SettingsPanelShell';
import { AnimatedNumber, ErrorPanel, SettingsPreviewLayout } from '../ui';

function resolutionKey(mode: DisplayMode): string {
  return `${mode.width}x${mode.height}`;
}

interface MonitorCardProps {
  monitor: DisplayMonitor;
  draft: DisplayMode;
  isDirty: boolean;
  error?: string;
  applied: boolean;
  onUpdate: (patch: Partial<DisplayMode>) => void;
  onApply: () => void;
  onDiscard: () => void;
}

function MonitorCard({
  monitor,
  draft,
  isDirty,
  error,
  applied,
  onUpdate,
  onApply,
  onDiscard,
}: MonitorCardProps) {
  const resolutions = useMemo(() => {
    const seen = new Map<string, { width: number; height: number }>();
    for (const mode of monitor.modes) {
      seen.set(resolutionKey(mode), { width: mode.width, height: mode.height });
    }
    return [...seen.values()].sort((a, b) => b.width * b.height - a.width * a.height);
  }, [monitor.modes]);

  const frequencies = useMemo(
    () =>
      monitor.modes
        .filter((mode) => mode.width === draft.width && mode.height === draft.height)
        .map((mode) => mode.frequency)
        .sort((a, b) => b - a),
    [monitor.modes, draft.width, draft.height]
  );

  function handleResolutionChange(value: string) {
    const [width, height] = value.split('x').map(Number);
    const choices = monitor.modes
      .filter((mode) => mode.width === width && mode.height === height)
      .map((mode) => mode.frequency)
      .sort((a, b) => b - a);
    onUpdate({ width, height, frequency: choices[0] ?? draft.frequency });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-primary" />
        <h4 className="text-sm font-semibold text-foreground">{monitor.label}</h4>
        {monitor.isPrimary && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            Principal
          </span>
        )}
      </div>

      <SettingsPreviewLayout
        preview={
          <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/40 p-3">
            <div className="relative h-12 w-20 shrink-0 rounded border-2 border-primary/40 bg-background">
              <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-primary/20 to-transparent" />
              <div className="absolute -bottom-1.5 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-b bg-primary/40" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                <AnimatedNumber value={draft.width} /> × <AnimatedNumber value={draft.height} />
              </p>
              <p className="text-xs text-primary">
                <AnimatedNumber value={draft.frequency} suffix=" Hz" />
              </p>
            </div>
          </div>
        }
        footer={
          <SettingsApplyFooter
            isDirty={isDirty}
            applied={applied}
            applyError={error}
            applyErrorTitle="Não foi possível aplicar"
            onApply={onApply}
            onDiscard={onDiscard}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label
              htmlFor={`display-resolution-${monitor.deviceName}`}
              className="text-xs font-medium text-foreground"
            >
              Resolução
            </label>
            <select
              id={`display-resolution-${monitor.deviceName}`}
              aria-label="Resolução"
              value={resolutionKey(draft)}
              onChange={(event) => handleResolutionChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {resolutions.map(({ width, height }) => (
                <option key={`${width}x${height}`} value={`${width}x${height}`}>
                  {width} × {height}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`display-frequency-${monitor.deviceName}`}
              className="text-xs font-medium text-foreground"
            >
              Taxa de atualização
            </label>
            <select
              id={`display-frequency-${monitor.deviceName}`}
              aria-label="Taxa de atualização"
              value={draft.frequency}
              onChange={(event) => onUpdate({ frequency: Number(event.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency} Hz
                </option>
              ))}
            </select>
          </div>
        </div>
      </SettingsPreviewLayout>
    </div>
  );
}

/** Painel com todos os monitores ativos e os modos reais oferecidos pelo Windows. */
export function DisplaySettingsPanel() {
  const { state, monitors, drafts, isDirty, errors, applied, update, apply, discard } =
    useDisplaySettings();

  if (state.status === 'error') {
    return (
      <ErrorPanel
        variant="card"
        title="Erro ao carregar ajustes do monitor"
        message={state.error}
        className="gap-0 border-destructive/30 bg-destructive/5 p-5"
        titleClassName="text-sm font-semibold text-destructive"
        messageClassName="mt-1 text-xs text-muted-foreground"
        icon={false}
      />
    );
  }

  if (state.status === 'loading') {
    return <PageSkeleton layout="settings" label="Carregando ajustes do monitor…" />;
  }

  return (
    <SettingsPanelShell
      badge="Por monitor"
      className="gap-4"
      note="A mudança pode desligar a tela por alguns segundos"
    >
      <div className="flex flex-col gap-4">
        {monitors.map((monitor) => {
          const draft = drafts[monitor.deviceName];
          if (!draft) return null;
          return (
            <MonitorCard
              key={monitor.deviceName}
              monitor={monitor}
              draft={draft}
              isDirty={isDirty(monitor.deviceName)}
              error={errors[monitor.deviceName]}
              applied={applied[monitor.deviceName] === true}
              onUpdate={(patch) => update(monitor.deviceName, patch)}
              onApply={() => void apply(monitor.deviceName)}
              onDiscard={() => discard(monitor.deviceName)}
            />
          );
        })}
      </div>
    </SettingsPanelShell>
  );
}
