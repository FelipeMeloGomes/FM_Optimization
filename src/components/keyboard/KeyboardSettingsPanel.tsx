import {
  DEFAULT_KEYBOARD_SETTINGS,
  KEYBOARD_BLINK_MAX,
  KEYBOARD_BLINK_MIN,
  KEYBOARD_REPEAT_DELAY_MAX,
  KEYBOARD_REPEAT_DELAY_MIN,
  KEYBOARD_REPEAT_RATE_MAX,
  KEYBOARD_REPEAT_RATE_MIN,
} from '../../../electron/shared/keyboard-settings';
import { useKeyboardSettings } from '../../hooks/use-keyboard-settings';
import { PageSkeleton } from '../PageSkeleton';
import { AnimatedNumber, Button, ErrorPanel, SettingsPreviewLayout } from '../ui';
import { KeyboardPreview } from './KeyboardPreview';

const REPEAT_DELAY_MS = [250, 500, 750, 1000];

export function KeyboardSettingsPanel() {
  const { state, draft, isDirty, applyError, appliedAt, update, apply, reset, discard } =
    useKeyboardSettings();

  if (state.status === 'error') {
    return (
      <ErrorPanel
        variant="card"
        title="Erro ao carregar ajustes do teclado"
        message={state.error}
        className="gap-0 border-destructive/30 bg-destructive/5 p-5"
        titleClassName="text-sm font-semibold text-destructive"
        messageClassName="mt-1 text-xs text-muted-foreground"
        icon={false}
      />
    );
  }

  if (state.status === 'loading' || !draft) {
    return <PageSkeleton layout="settings" label="Carregando ajustes do teclado…" />;
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
          <KeyboardPreview
            repeatDelay={draft.repeatDelay}
            repeatRate={draft.repeatRate}
            caretBlinkRate={draft.caretBlinkRate}
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
                onClick={() => void apply(DEFAULT_KEYBOARD_SETTINGS)}
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
              <label htmlFor="keyboard-repeat-delay" className="font-medium text-foreground">
                Atraso até repetir
              </label>
              <AnimatedNumber
                value={REPEAT_DELAY_MS[draft.repeatDelay]}
                suffix=" ms"
                className="font-semibold text-primary"
              />
            </div>
            <input
              id="keyboard-repeat-delay"
              aria-label="Atraso até repetir"
              type="range"
              min={KEYBOARD_REPEAT_DELAY_MIN}
              max={KEYBOARD_REPEAT_DELAY_MAX}
              value={draft.repeatDelay}
              onChange={(event) => update({ repeatDelay: Number(event.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="keyboard-repeat-rate" className="font-medium text-foreground">
                Velocidade de repetição
              </label>
              <AnimatedNumber
                value={draft.repeatRate}
                suffix={` / ${KEYBOARD_REPEAT_RATE_MAX}`}
                className="font-semibold text-primary"
              />
            </div>
            <input
              id="keyboard-repeat-rate"
              aria-label="Velocidade de repetição"
              type="range"
              min={KEYBOARD_REPEAT_RATE_MIN}
              max={KEYBOARD_REPEAT_RATE_MAX}
              value={draft.repeatRate}
              onChange={(event) => update({ repeatRate: Number(event.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="keyboard-blink-rate" className="font-medium text-foreground">
                Piscagem do cursor
              </label>
              <AnimatedNumber
                value={draft.caretBlinkRate}
                suffix=" ms"
                className="rounded-md bg-muted px-2 py-1 font-semibold text-foreground"
              />
            </div>
            <input
              id="keyboard-blink-rate"
              aria-label="Piscagem do cursor"
              type="range"
              min={KEYBOARD_BLINK_MIN}
              max={KEYBOARD_BLINK_MAX}
              step={50}
              value={draft.caretBlinkRate}
              onChange={(event) => update({ caretBlinkRate: Number(event.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>
        </div>
      </SettingsPreviewLayout>
    </section>
  );
}
