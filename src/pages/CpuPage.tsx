import { AlertTriangle, Gauge } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { ConfirmBulkScriptDialog } from '../components/ConfirmBulkScriptDialog';
import { AnimatedCpu } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSelectionToolbar } from '../components/ScriptSelectionToolbar';
import { Button, Card, CardContent } from '../components/ui';
import { VirtualizedScriptList } from '../components/VirtualizedScriptList';
import { useCpuContext, useMemoryContext } from '../contexts/SystemContext';
import { useCpuVendor } from '../hooks/use-cpu-vendor';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { CPU_CATEGORY } from '../lib/cpu-vendor';
import { PERFORMANCE_SECTIONS } from '../lib/performance-sections';
import { getRamScriptId } from '../lib/ram-script';
import { cn } from '../lib/utils';

// Scripts de pacote amplo: continuam no catálogo, mas não viram card nesta
// página — o botão "Selecionar todos" da barra de seleção cumpre esse papel.
const BULK_SCRIPT_IDS = ['tweaks-3', 'tweaks-4'];

export default function CpuPage() {
  const { state: cpuState, refresh: refreshCpu, hasFetched: cpuFetched } = useCpuContext();
  const {
    state: memoryState,
    refresh: refreshMemory,
    hasFetched: memoryFetched,
  } = useMemoryContext();
  const { effective: cpuVendor, categories, isManual, setOverride, clearOverride } = useCpuVendor();

  useEffect(() => {
    if (!cpuFetched) refreshCpu();
    if (!memoryFetched) refreshMemory();
  }, [cpuFetched, memoryFetched, refreshCpu, refreshMemory]);

  const isUnidentified = cpuVendor === 'unknown';
  const cpuModel = cpuState.status === 'success' ? cpuState.data.model : null;
  const tone = cpuVendor === 'amd' ? 'red' : cpuVendor === 'intel' ? 'blue' : 'amber';
  const vendorLabel = cpuVendor === 'amd' ? 'AMD' : cpuVendor === 'intel' ? 'Intel' : 'AMD / Intel';

  const ramAmount = useMemo(() => {
    if (memoryState.status !== 'success') return null;
    const match = memoryState.data.total.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }, [memoryState]);

  const recommendedRamScriptId = useMemo(() => {
    if (!ramAmount) return null;
    return getRamScriptId(ramAmount);
  }, [ramAmount]);

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
  } = useScriptPage(categories);

  // Remove os pacotes amplos da lista selecionável: eles não aparecem como
  // card, mas a barra "Selecionar todos" cobre os tweaks individuais.
  const scriptsSemPacotes = useMemo(
    () => categoryScripts.filter((s) => !BULK_SCRIPT_IDS.includes(s.id)),
    [categoryScripts]
  );

  // `categoryScripts` holds every category routed to this page (CPU, GPU and
  // Windows). The processor section must take only the CPU ones — otherwise
  // GPU/Windows scripts show up here as well as in their own cards. On top of
  // that, the RAM ladder lists only the tier matching the installed memory.
  const cpuScripts = useMemo(() => {
    return scriptsSemPacotes.filter((s) => {
      if (s.category !== CPU_CATEGORY) return false;
      if (s.subcategory === 'RAM') {
        return s.id === recommendedRamScriptId;
      }
      return true;
    });
  }, [scriptsSemPacotes, recommendedRamScriptId]);

  // Each section is fed by a catalog category, so a script can never be filed
  // under a section about different hardware (an AMD GPU tweak can't show up as
  // a universal CPU tweak).
  const sections = useMemo(
    () =>
      PERFORMANCE_SECTIONS.map((section) => {
        const scripts =
          section.category === CPU_CATEGORY
            ? cpuScripts
            : scriptsSemPacotes.filter((s) => s.category === section.category);
        return {
          section: { ...section, scriptIds: scripts.map((s) => s.id) },
          scripts,
        };
      }),
    [scriptsSemPacotes, cpuScripts]
  );

  // União dos scripts efetivamente visíveis nas seções com conteúdo: a seleção
  // abrange exatamente o que o usuário vê (respeitando a escada de RAM).
  const visibleScripts = useMemo(() => {
    const ids = new Set<string>();
    const out: typeof cpuScripts = [];
    for (const { scripts } of sections) {
      if (scripts.length === 0) continue;
      for (const s of scripts) {
        if (!ids.has(s.id)) {
          ids.add(s.id);
          out.push(s);
        }
      }
    }
    return out;
  }, [sections]);

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);

  const disabled = !!batch;

  // Gate on both: until the CPU read settles the vendor is `unknown`, and
  // rendering then would flash the combined AMD+Intel list at the user.
  if (cpuState.status === 'loading' || state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PERFORMANCE_SECTIONS.length }).map((_, i) => (
            <ScriptCardSkeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, fixed count
              key={`skeleton-${i}`}
            />
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
      <HeroBanner visual={<AnimatedCpu />}>
        <div className="relative p-6">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Desempenho
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Otimização do Sistema</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Ajustes de hardware e do Windows para extrair mais desempenho e estabilidade do seu PC.
          </p>
        </div>
      </HeroBanner>

      {/* Vendor notice: unidentified CPU, or a manual override in effect */}
      {isUnidentified && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Processador não identificado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {cpuModel
                  ? `Nenhum fabricante Intel ou AMD reconhecido em "${cpuModel}". `
                  : 'Nenhum fabricante Intel ou AMD reconhecido. '}
                A identificação não muda quais ajustes aparecem: os ajustes de processador valem
                para os dois fabricantes e os cards de GPU e Windows não dependem dela.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOverride('amd')}>
                AMD
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOverride('intel')}>
                Intel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isManual && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Seleção manual ({vendorLabel}) — a detecção automática não reconheceu este processador.
          </p>
          <Button size="sm" variant="ghost" onClick={clearOverride}>
            Usar detecção automática
          </Button>
        </div>
      )}

      {/* Scripts Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div
            className={cn(
              'size-1.5 rounded-full',
              tone === 'red' ? 'bg-destructive' : tone === 'blue' ? 'bg-info' : 'bg-warning'
            )}
          />
          <h3 className="text-sm font-semibold text-foreground">Scripts Disponíveis</h3>
        </div>

        {categoryScripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <p className="text-sm">Nenhum script encontrado</p>
            <p className="text-xs text-muted-foreground">Tente ajustar sua busca ou filtro</p>
          </div>
        ) : (
          <div className="space-y-4">
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
            <VirtualizedScriptList
              scripts={visibleScripts}
              activeExecution={activeExecution}
              onCancel={handleCancel}
              selectedIds={selectedIds}
              onToggle={toggle}
              disabled={disabled}
            />
          </div>
        )}
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
