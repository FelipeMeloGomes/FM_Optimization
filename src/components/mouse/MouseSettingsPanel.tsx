import {
  DEFAULT_MOUSE_SETTINGS,
  MOUSE_DOUBLE_CLICK_MAX,
  MOUSE_DOUBLE_CLICK_MIN,
  MOUSE_POINTER_SPEED_MAX,
  MOUSE_POINTER_SPEED_MIN,
} from '../../../electron/shared/mouse-settings';
import { useMouseSettings } from '../../hooks/use-mouse-settings';
import { Button, Switch } from '../ui';
import { MouseTrailPreview } from './MouseTrailPreview';

export function MouseSettingsPanel() {
  const { state, draft, isDirty, applyError, appliedAt, update, apply, reset, discard } =
    useMouseSettings();

  if (state.status === 'error') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-semibold text-destructive">Erro ao carregar ajustes do mouse</p>
        <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
      </div>
    );
  }

  if (state.status === 'loading' || !draft) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ajustes do Windows</h3>
          <p className="text-xs text-muted-foreground">
            Configurações reais do sistema — carregadas com os valores atuais
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          valores atuais
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="mouse-pointer-speed" className="font-medium text-foreground">
            Velocidade do ponteiro
          </label>
          <span className="font-semibold text-primary">
            {draft.pointerSpeed} / {MOUSE_POINTER_SPEED_MAX}
          </span>
        </div>
        <input
          id="mouse-pointer-speed"
          aria-label="Velocidade do ponteiro"
          type="range"
          min={MOUSE_POINTER_SPEED_MIN}
          max={MOUSE_POINTER_SPEED_MAX}
          value={draft.pointerSpeed}
          onChange={(event) => update({ pointerSpeed: Number(event.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Lento</span>
          <span>Padrão (10)</span>
          <span>Rápido</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
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

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="mouse-double-click" className="font-medium text-foreground">
            Tempo de duplo clique
          </label>
          <span className="rounded-md bg-muted px-2 py-1 font-semibold text-foreground">
            {draft.doubleClickSpeed} ms
          </span>
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
          className="w-full accent-primary"
        />
        <p className="text-[10px] text-muted-foreground">tempo de resposta entre os dois cliques</p>
      </div>

      <MouseTrailPreview
        pointerSpeed={draft.pointerSpeed}
        enhancedPrecision={draft.enhancedPrecision}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button size="sm" disabled={!isDirty} onClick={() => void apply()}>
          Aplicar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void apply(DEFAULT_MOUSE_SETTINGS)}>
          Restaurar padrão
        </Button>
        <Button size="sm" variant="ghost" disabled={!isDirty} onClick={discard}>
          Cancelar alterações
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Preencher com padrões
        </Button>
      </div>

      {appliedAt && <p className="text-xs text-primary">Ajustes aplicados</p>}
      {applyError && (
        <p className="text-xs text-destructive">
          Não foi possível aplicar os ajustes: {applyError}
        </p>
      )}
    </section>
  );
}
