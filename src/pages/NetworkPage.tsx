import { Wifi } from 'lucide-react';
import { useMemo } from 'react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedNetwork } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedScriptList } from '../components/VirtualizedScriptList';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { NETWORK_SECTIONS } from '../lib/network-sections';

/**
 * A configuração visual de DNS saiu daqui para `DnsPage` (/dns). Esta página
 * mantém só os scripts de rede, apresentados em uma lista única no padrão
 * da Limpeza, com barra de seleção e confirmação de lote.
 */
export default function NetworkPage() {
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
  } = useScriptPage(['Internet', 'DNS Manager']);

  // Ordem de exibição preservada: a lista é achatada na ordem das seções, sem
  // agrupá-las em cards. Ids fora das seções não entram na lista nem na seleção.
  const visibleScripts = useMemo(
    () => scriptsInSectionOrder(NETWORK_SECTIONS, categoryScripts),
    [categoryScripts]
  );

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: NETWORK_SECTIONS.length }).map((_, i) => (
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
      <HeroBanner visual={<AnimatedNetwork />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Rede
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Internet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Scripts para otimizar sua conexão de internet e corrigir problemas de rede. Para
            escolher e aplicar um provedor DNS, use a página DNS.
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
