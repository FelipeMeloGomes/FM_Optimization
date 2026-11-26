import {
  DEFAULT_MOUSE_SETTINGS,
  MOUSE_DOUBLE_CLICK_MAX,
  MOUSE_DOUBLE_CLICK_MIN,
  MOUSE_POINTER_SPEED_MAX,
  MOUSE_POINTER_SPEED_MIN,
} from '../../../electron/shared/mouse-settings';
import { useMouseSettings } from '../../hooks/use-mouse-settings';
import { PageSkeleton } from '../PageSkeleton';
import { SettingsApplyFooter } from '../settings/SettingsApplyFooter';
import { SettingsPanelShell } from '../settings/SettingsPanelShell';
import { AnimatedNumber, ErrorPanel, SettingsPreviewLayout, Switch } from '../ui';
import { MouseTrailPreview } from './MouseTrailPreview';

export function MouseSettingsPanel() {
  const { state, draft, isDirty, applyError, appliedAt, update, apply, reset, discard } =
    useMouseSettings();

  if (state.status === 'error') {
    return (
      <ErrorPanel
        variant="card"
        title="Erro ao carregar ajustes do mouse"
        message={state.error}
        className="gap-0 border-destructive/30 bg-destructive/5 p-5"
        titleClassName="text-sm font-semibold text-destructive"
        messageClassName="mt-1 text-xs text-muted-foreground"
        icon={false}
      />
    );
  }

  if (state.status === 'loading' || !draft) {
    return <PageSkeleton layout="settings" label="Carregando ajustes do mouse…" />;
  }

  return (
    <SettingsPanelShell badge="tempo real">
      <SettingsPreviewLayout
        preview={
          <MouseTrailPreview
            pointerSpeed={draft.pointerSpeed}
            enhancedPrecision={draft.enhancedPrecision}
          />
        }
        footer={
          <SettingsApplyFooter
            isDirty={isDirty}
            appliedAt={appliedAt}
            applyError={applyError}
            onApply={() => void apply()}
            onRestoreDefault={() => void apply(DEFAULT_MOUSE_SETTINGS)}
            onDiscard={discard}
            onFillDefaults={reset}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="mouse-pointer-speed" className="font-medium text-foreground">
                Velocidade do ponteiro
              </label>
              <AnimatedNumber
                value={draft.pointerSpeed}
                suffix={` / ${MOUSE_POINTER_SPEED_MAX}`}
                className="font-semibold text-primary"
              />
            </div>
            <input
              id="mouse-pointer-speed"
              aria-label="Velocidade do ponteiro"
              type="range"
              min={MOUSE_POINTER_SPEED_MIN}
              max={MOUSE_POINTER_SPEED_MAX}
              value={draft.pointerSpeed}
              onChange={(event) => update({ pointerSpeed: Number(event.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">Melhorar precisão do ponteiro</p>
              <p className="text-[11px] text-muted-foreground">aceleração do Windows</p>
            </div>
            <Switch
              aria-label="Melhorar precisão do ponteiro"
              checked={draft.enhancedPrecision}
              onCheckedChange={(checked) => update({ enhancedPrecision: checked })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="mouse-double-click" className="font-medium text-foreground">
                Tempo de duplo clique
              </label>
              <AnimatedNumber
                value={draft.doubleClickSpeed}
                suffix=" ms"
                className="rounded-md bg-muted px-2 py-1 font-semibold text-foreground"
              />
            </div>
            <input
              id="mouse-double-click"
              aria-label="Tempo de duplo clique"
              type="range"
              min={MOUSE_DOUBLE_CLICK_MIN}
              max={MOUSE_DOUBLE_CLICK_MAX}
              step={50}
              value={draft.doubleClickSpeed}
              onChange={(event) => update({ doubleClickSpeed: Number(event.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>
        </div>
      </SettingsPreviewLayout>
    </SettingsPanelShell>
  );
}
