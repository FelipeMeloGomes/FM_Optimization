import { FileDown, FileUp } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';

export function DataSection() {
  const { exportData, importData } = useSettingsContext();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="size-1.5 rounded-full bg-info" />
        <h3 className="text-sm font-semibold text-foreground">Dados</h3>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm text-muted-foreground">
          Exporte ou importe suas configuracoes e historico.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={exportData}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <FileDown className="size-4" />
            Exportar Dados
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
            <FileUp className="size-4" />
            Importar Dados
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importData(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
