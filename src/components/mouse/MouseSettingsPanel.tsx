import {
  DEFAULT_MOUSE_SETTINGS,
  MOUSE_DOUBLE_CLICK_MAX,
  MOUSE_DOUBLE_CLICK_MIN,
  MOUSE_POINTER_SPEED_MAX,
  MOUSE_POINTER_SPEED_MIN,
} from '../../../electron/shared/mouse-settings';
import { useMouseSettings } from '../../hooks/use-mouse-settings';
import { PageSkeleton } from '../PageSkeleton';
import { AnimatedNumber, Button, ErrorPanel, SettingsPreviewLayout, Switch } from '../ui';
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
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Ajustes do Windows</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          tempo real
        </span>
      </div>

      <SettingsPreviewLayout
        preview={
          <MouseTrailPreview
            pointerSpeed={draft.pointerSpeed}
            enhancedPrecision={draft.enhancedPrecision}
          />
        }
        footer={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={!isDirty} onClick={() => void apply()}>
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void apply(DEFAULT_MOUSE_SETTINGS)}
              >
                Restaurar padrão
              </Button>
              <Button size="sm" variant="ghost" disabled={!isDirty} onClick={discard}>
                Cancelar alterações
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                Preencher com padrões
              </Button>
            </div>
            {appliedAt && <p className="mt-2 text-xs text-primary">Ajustes aplicados</p>}
            {applyError && (
              <ErrorPanel
                variant="inline"
                title="Não foi possível aplicar os ajustes"
                message={applyError}
                messageSeparator=": "
                className="mt-2 border-0 bg-transparent p-0"
                titleClassName="text-xs text-destructive"
                messageClassName="text-xs text-destructive"
                icon={false}
              />
            )}
          </>
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
    </section>
  );
}
