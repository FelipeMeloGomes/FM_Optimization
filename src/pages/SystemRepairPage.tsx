import { ShieldCheck } from 'lucide-react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedRepair } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { REPAIR_SECTIONS } from '../lib/repair-sections';

export default function SystemRepairPage() {
  const {
    state,
    categoryScripts,
    activeExecution,
    handleCancel,
    handleApply,
    batch,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    failedScripts,
    clearFailures,
  } = useScriptPage('Reparo do Sistema');

  const visibleScripts = categoryScripts;

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: REPAIR_SECTIONS.length }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedRepair />}>
        <div className="relative p-6">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Ferramentas
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Reparo do Sistema</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Verifique e repare arquivos corrompidos do Windows e erros no disco.
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

      {/* Repair Sections */}
      <div className="space-y-4">
        {REPAIR_SECTIONS.map((section) => {
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
