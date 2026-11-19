import { HardDrive } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AnimatedStorage } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { STORAGE_SECTIONS } from '../lib/storage-sections';

/** Tweaks que só fazem sentido em máquinas com SSD (herdados de Utilitários). */
const SSD_ONLY_IDS = ['util-4', 'builtin-88'];

export default function StoragePage() {
  const {
    state,
    categoryScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage('Armazenamento');
  const [hasSSD, setHasSSD] = useState<boolean | null>(null);

  useEffect(() => {
    window.electronAPI
      .hasSSD()
      .then(setHasSSD)
      .catch(() => setHasSSD(false));
  }, []);

  const visibleScripts = useMemo(
    () =>
      hasSSD === true
        ? categoryScripts
        : categoryScripts.filter((script) => !SSD_ONLY_IDS.includes(script.id)),
    [categoryScripts, hasSSD]
  );

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: STORAGE_SECTIONS.length }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, fixed count
            <ScriptCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar tweaks</p>
        <p className="text-xs text-destructive">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner visual={<AnimatedStorage />}>
        <div className="relative p-6">
          <div className="mb-2 flex items-center gap-2">
            <HardDrive className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Ferramentas
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Armazenamento</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Libere espaço em disco, otimize o SSD e compacte os arquivos do sistema.
          </p>
        </div>
      </HeroBanner>

      {/* Storage Sections */}
      {STORAGE_SECTIONS.map((section) => (
        <VirtualizedSectionCard
          key={section.id}
          section={section}
          scripts={visibleScripts}
          activeExecution={activeExecution}
          onCancel={handleCancel}
          onConfirmExecute={handleConfirmExecute}
        />
      ))}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmScript}
        onOpenChange={(open) => {
          if (!open) setConfirmScript(null);
        }}
        script={confirmScript}
        onConfirm={handleConfirm}
        isExecuting={!!confirmScript && activeExecution === confirmScript.id}
      />
    </div>
  );
}
