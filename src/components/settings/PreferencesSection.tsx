import { useSettingsContext } from '../../contexts/SettingsContext';
import { Toggle } from '../ui';
import { SettingsSectionShell } from './SettingsSectionShell';

export function PreferencesSection() {
  const { settings, update } = useSettingsContext();

  return (
    <SettingsSectionShell title="Preferencias" tone="primary">
      <Toggle
        id="confirm-execution"
        label="Confirmar Execucao"
        description="Confirmar antes de executar tweaks"
        checked={settings.confirmOnExecute}
        onChange={(e) => update({ confirmOnExecute: e.target.checked })}
      />
      <Toggle
        id="auto-restore-point"
        label="Restore Point Automatico"
        description="Criar ponto de restauracao antes de executar tweaks"
        checked={settings.autoRestorePoint}
        onChange={(e) => update({ autoRestorePoint: e.target.checked })}
      />
      <Toggle
        id="power-save-mode"
        label="Modo Economia"
        description="Reduz uso de CPU/GPU desativando aceleracao de hardware e aumentando cache (requer reinicio)"
        checked={settings.powerSaveMode}
        onChange={(e) => update({ powerSaveMode: e.target.checked })}
      />
    </SettingsSectionShell>
  );
}
