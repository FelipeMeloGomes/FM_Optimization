import { Palette } from 'lucide-react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedPersonalization } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { PERSONALIZATION_SECTIONS } from '../lib/personalization-sections';

export default function PersonalizationPage() {
  const {
    state,
    categoryScripts: personalizationScripts,
    activeExecution,
    handleCancel,
    handleApply,
    batch,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    failedScripts,
    clearFailures,
  } = useScriptPage('Personalização');

  const visibleScripts = personalizationScripts;

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PERSONALIZATION_SECTIONS.length }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedPersonalization />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Personalização
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Aparência e mods de apps</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Ajuste a barra de tarefas, o menu de contexto e os efeitos visuais, ou aplique mods no
            Discord e no Spotify. Os mods de apps incluem a opção de reverter.
          </p>
        </div>
      </HeroBanner>

      {/* Seleção múltipla */}
      <ScriptSelectionToolbar
        availableIds={visibleScripts.map((s) => s.id)}
        selectedIds={selectedIds}
        selectedScripts={selectedScripts}
        onSelectAll={selectAll}
        onClear={clear}
        onApply={handleApply}
        applying={disabled}
        progress={batch ? { index: batch.index, total: batch.ids.length } : null}
        failedScripts={failedScripts}
        onDismissFailures={clearFailures}
      />

      {/* Personalization Sections */}
      <div className="space-y-4">
        {PERSONALIZATION_SECTIONS.map((section) => {
          const scripts = visibleScripts.filter((s) => section.scriptIds.includes(s.id));
          return (
            <VirtualizedSectionCard
              key={section.id}
              section={section}
              scripts={scripts}
              activeExecution={activeExecution}
              onCancel={handleCancel}
              selectedIds={selectedIds}
              onToggle={toggle}
              disabled={disabled}
            />
          );
        })}
      </div>

      {/* Confirmação do lote */}
      <ConfirmBulkScriptDialog
        open={confirmBulkScripts.length > 0}
        onOpenChange={(open) => {
          if (!open) setConfirmBulkScripts([]);
        }}
        scripts={confirmBulkScripts}
        onConfirm={handleConfirmBulk}
      />
    </div>
  );
}
