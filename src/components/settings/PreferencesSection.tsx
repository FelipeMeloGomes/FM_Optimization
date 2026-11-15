import { useSettingsContext } from '../../contexts/SettingsContext';
import { Toggle } from '../ui';

export function PreferencesSection() {
  const { settings, update } = useSettingsContext();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="size-1.5 rounded-full bg-primary" />
        <h3 className="text-sm font-semibold text-foreground">Preferencias</h3>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        <div className="p-4 transition-colors duration-200 hover:bg-muted/30">
          <Toggle
            id="confirm-execution"
            label="Confirmar Execucao"
            description="Confirmar antes de executar tweaks"
            checked={settings.confirmOnExecute}
            onChange={(e) => update({ confirmOnExecute: e.target.checked })}
          />
        </div>
        <div className="p-4 transition-colors duration-200 hover:bg-muted/30">
          <Toggle
            id="auto-restore-point"
            label="Restore Point Automatico"
            description="Criar ponto de restauracao antes de executar tweaks"
            checked={settings.autoRestorePoint}
            onChange={(e) => update({ autoRestorePoint: e.target.checked })}
          />
        </div>
        <div className="p-4 transition-colors duration-200 hover:bg-muted/30">
          <Toggle
            id="power-save-mode"
            label="Modo Economia"
            description="Reduz uso de CPU/GPU desativando aceleracao de hardware e aumentando cache (requer reinicio)"
            checked={settings.powerSaveMode}
            onChange={(e) => update({ powerSaveMode: e.target.checked })}
          />
        </div>
      </div>
    </div>
  );
}
