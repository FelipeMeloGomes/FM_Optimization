import { ShieldCheck } from 'lucide-react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedPrivacySecurity } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { PRIVACY_SECTIONS } from '../lib/privacy-sections';

export default function PrivacySecurityPage() {
  const {
    state,
    categoryScripts: privacyScripts,
    activeExecution,
    handleCancel,
    handleApply,
    batch,
    confirmBulkScripts,
    setConfirmBulkScripts,
    handleConfirmBulk,
    failedScripts,
    clearFailures,
  } = useScriptPage('Segurança');

  const visibleScripts = privacyScripts;

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PRIVACY_SECTIONS.length }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedPrivacySecurity />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Privacidade
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Privacidade do Windows</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Desative telemetria e coleta de dados e bloqueie a instalação forçada de apps sugeridos
            pelo sistema. Estes ajustes não alteram o Windows Defender nem o Windows Update.
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

      {/* Privacy Sections */}
      <div className="space-y-4">
        {PRIVACY_SECTIONS.map((section) => {
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
