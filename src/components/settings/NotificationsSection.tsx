import { useSettingsContext } from '../../contexts/SettingsContext';
import { Toggle } from '../ui';
import { SettingsSectionShell } from './SettingsSectionShell';

export function NotificationsSection() {
  const { settings, update } = useSettingsContext();

  return (
    <SettingsSectionShell title="Notificacoes" tone="warning">
      <Toggle
        id="sound-enabled"
        label="Som nas notificacoes"
        description="Reproduzir som ao receber notificacoes"
        checked={settings.soundEnabled}
        onChange={(e) => update({ soundEnabled: e.target.checked })}
      />
      <div className="flex items-center justify-between">
        <div>
          <label htmlFor="toast-duration" className="text-sm font-medium text-foreground">
            Duracao dos toasts
          </label>
          <p className="text-xs text-muted-foreground">Tempo que as notificacoes ficam visiveis</p>
        </div>
        <select
          id="toast-duration"
          value={settings.toastDuration}
          onChange={(e) => update({ toastDuration: e.target.value as 'short' | 'medium' | 'long' })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="short">Curta (2s)</option>
          <option value="medium">Media (4s)</option>
          <option value="long">Longa (8s)</option>
        </select>
      </div>
    </SettingsSectionShell>
  );
}
