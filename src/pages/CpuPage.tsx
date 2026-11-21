import { AlertTriangle, Gauge } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedCpu } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { Button, Card, CardContent } from '../components/ui';
import { useCpuContext, useMemoryContext } from '../contexts/SystemContext';
import { useCpuVendor } from '../hooks/use-cpu-vendor';
import { CPU_CATEGORY } from '../lib/cpu-vendor';
import { PERFORMANCE_SECTIONS } from '../lib/performance-sections';
import { getRamScriptId } from '../lib/ram-script';

// Scripts de pacote amplo: continuam no catálogo, mas não viram tweak nesta
// página — o botão "Selecionar todos" da barra de seleção cumpre esse papel.
const BULK_SCRIPT_IDS = ['tweaks-3', 'tweaks-4'];

const HERO = {
  icon: Gauge,
  badge: 'Desempenho',
  title: 'Otimização do Sistema',
  description:
    'Ajustes de hardware e do Windows para extrair mais desempenho e estabilidade do seu PC.',
  visual: <AnimatedCpu />,
};

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
  const vendorLabel = cpuVendor === 'amd' ? 'AMD' : cpuVendor === 'intel' ? 'Intel' : 'AMD / Intel';

  const ramAmount = useMemo(() => {
    if (memoryState.status !== 'success') return null;
    const match = memoryState.data.total.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }, [memoryState]);

  const recommendedRamScriptId = useMemo(
    () => (ramAmount ? getRamScriptId(ramAmount) : null),
    [ramAmount]
  );

  // `categoryScripts` holds every category routed to this page (CPU, GPU and
  // Windows). The processor section takes only CPU scripts — otherwise GPU and
  // Windows tweaks show up here too. On top of that, the RAM ladder lists only
  // the tier matching the installed memory.
  const transform = useCallback(
    (scripts: ScriptEntry[]) => {
      const semPacotes = scripts.filter((s) => !BULK_SCRIPT_IDS.includes(s.id));
      const cpuScripts = semPacotes.filter((s) => {
        if (s.category !== CPU_CATEGORY) return false;
        if (s.subcategory === 'RAM') return s.id === recommendedRamScriptId;
        return true;
      });
      const sections = PERFORMANCE_SECTIONS.map((section) => ({
        scripts:
          section.category === CPU_CATEGORY
            ? cpuScripts
            : semPacotes.filter((s) => s.category === section.category),
      }));
      const ids = new Set<string>();
      const out: ScriptEntry[] = [];
      for (const { scripts: sectionScripts } of sections) {
        if (sectionScripts.length === 0) continue;
        for (const script of sectionScripts) {
          if (ids.has(script.id)) continue;
          ids.add(script.id);
          out.push(script);
        }
      }
      return out;
    },
    [recommendedRamScriptId]
  );

  // Avisos de fabricante ficam entre o hero e a barra, como antes.
  const beforeList = useCallback(
    () => (
      <>
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
              Seleção manual ({vendorLabel}) — a detecção automática não reconheceu este
              processador.
            </p>
            <Button size="sm" variant="ghost" onClick={clearOverride}>
              Usar detecção automática
            </Button>
          </div>
        )}
      </>
    ),
    [isUnidentified, cpuModel, isManual, vendorLabel, setOverride, clearOverride]
  );

  return (
    <TweaksPage
      category={categories}
      hero={HERO}
      skeletonCount={PERFORMANCE_SECTIONS.length}
      transform={transform}
      beforeList={beforeList}
      extraLoading={cpuState.status === 'loading'}
      compactToolbarGap
    />
  );
}
