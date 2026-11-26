import { FileDown, FileUp } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { SettingsSectionShell } from './SettingsSectionShell';

export function DataSection() {
  const { exportData, importData } = useSettingsContext();

  return (
    <SettingsSectionShell title="Dados" tone="info" variant="panel">
      <p className="mb-4 text-sm text-muted-foreground">
        Exporte ou importe suas configuracoes e historico.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={exportData}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <FileDown className="size-4" />
          Exportar Dados
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
          <FileUp className="size-4" aria-hidden="true" />
          Importar Dados
          <input
            type="file"
            accept=".json"
            aria-label="Importar Dados"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importData(file);
            }}
          />
        </label>
      </div>
    </SettingsSectionShell>
  );
}
