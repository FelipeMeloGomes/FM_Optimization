import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedUtilities } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedScriptList } from '../components/VirtualizedScriptList';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { UTIL_SECTIONS } from '../lib/util-sections';

export default function UtilitiesPage() {
  const {
    state,
    categoryScripts: utilScripts,
    activeExecution,
    handleCancel,
    handleApply,
    batch,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    failedScripts,
    clearFailures,
  } = useScriptPage('Utilities');

  // A ordem visual antiga das seções é preservada na lista única, sem cards.
  const visibleScripts = useMemo(
    () => scriptsInSectionOrder(UTIL_SECTIONS, utilScripts),
    [utilScripts]
  );

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: UTIL_SECTIONS.length }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedUtilities />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Utilitários
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Ferramentas de manutenção e reparo</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Mantenha seu sistema saudável com ferramentas de manutenção, gerenciamento de memória e
            otimizações gerais de desempenho.
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

      {/* Lista única de tweaks */}
      <VirtualizedScriptList
        scripts={visibleScripts}
        activeExecution={activeExecution}
        onCancel={handleCancel}
        selectedIds={selectedIds}
        onToggle={toggle}
        disabled={disabled}
      />

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
