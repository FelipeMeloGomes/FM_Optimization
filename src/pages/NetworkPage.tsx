import { Wifi } from 'lucide-react';
import { useMemo } from 'react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedNetwork } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { NETWORK_SECTIONS } from '../lib/network-sections';

/**
 * A configuração visual de DNS saiu daqui para `DnsPage` (/dns). Esta página
 * mantém só os scripts de rede, apresentados no mesmo padrão das demais:
 * seções em `VirtualizedSectionCard` + seleção múltipla com barra de seleção
 * e confirmação de lote.
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

  // Ids que realmente têm card nesta página: a união dos `scriptIds` das
  // seções. Scripts do catálogo que não caem em nenhuma seção não são
  // selecionáveis aqui.
  const networkScriptIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of NETWORK_SECTIONS) {
      for (const id of section.scriptIds) {
        ids.add(id);
      }
    }
    return ids;
  }, []);

  const visibleScripts = useMemo(
    () => categoryScripts.filter((s) => networkScriptIds.has(s.id)),
    [categoryScripts, networkScriptIds]
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

      {/* Network Sections */}
      <div className="space-y-4">
        {NETWORK_SECTIONS.map((section) => {
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
