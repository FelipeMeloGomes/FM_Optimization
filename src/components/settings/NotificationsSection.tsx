import { useSettingsContext } from '../../contexts/SettingsContext';
import { Toggle } from '../ui';

export function NotificationsSection() {
  const { settings, update } = useSettingsContext();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="size-1.5 rounded-full bg-warning" />
        <h3 className="text-sm font-semibold text-foreground">Notificacoes</h3>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        <div className="p-4 transition-colors duration-200 hover:bg-muted/30">
          <Toggle
            id="sound-enabled"
            label="Som nas notificacoes"
            description="Reproduzir som ao receber notificacoes"
            checked={settings.soundEnabled}
            onChange={(e) => update({ soundEnabled: e.target.checked })}
          />
        </div>
        <div className="p-4 transition-colors duration-200 hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="toast-duration" className="text-sm font-medium text-foreground">
                Duracao dos toasts
              </label>
              <p className="text-xs text-muted-foreground">
                Tempo que as notificacoes ficam visiveis
              </p>
            </div>
            <select
              id="toast-duration"
              value={settings.toastDuration}
              onChange={(e) =>
                update({ toastDuration: e.target.value as 'short' | 'medium' | 'long' })
              }
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="short">Curta (2s)</option>
              <option value="medium">Media (4s)</option>
              <option value="long">Longa (8s)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
