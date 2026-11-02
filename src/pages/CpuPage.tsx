import { AlertTriangle, Cpu } from 'lucide-react';
import { useMemo } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSectionCard } from '../components/ScriptSectionCard';
import { Badge, Button, Card, CardContent } from '../components/ui';
import { useCpuContext, useMemoryContext } from '../contexts/SystemContext';
import { useCpuVendor } from '../hooks/use-cpu-vendor';
import { useScriptPage } from '../hooks/use-script-page';
import { CPU_CATEGORY } from '../lib/cpu-vendor';
import { PERFORMANCE_SECTIONS } from '../lib/performance-sections';
import { getRamScriptId } from '../lib/ram-script';
import { cn } from '../lib/utils';

// Neutral amber for the unidentified case: a blue "Intel" hero would mislabel a
// page that is listing both sets.
const TONE_TEXT = { red: 'text-red-400', blue: 'text-blue-400', amber: 'text-yellow-400' } as const;
const TONE_BG = {
  red: 'bg-red-500/10',
  blue: 'bg-blue-500/10',
  amber: 'bg-yellow-500/10',
} as const;
const TONE_BG_FAINT = {
  red: 'from-red-500/10',
  blue: 'from-blue-500/10',
  amber: 'from-yellow-500/10',
} as const;
const TONE_BORDER = {
  red: 'border-red-500/20',
  blue: 'border-blue-500/20',
  amber: 'border-yellow-500/20',
} as const;
const TONE_BADGE = {
  red: 'bg-red-500/10 text-red-400',
  blue: 'bg-blue-500/10 text-blue-400',
  amber: 'bg-yellow-500/10 text-yellow-400',
} as const;

export default function CpuPage() {
  const { state: cpuState } = useCpuContext();
  const { state: memoryState } = useMemoryContext();
  const { effective: cpuVendor, categories, isManual, setOverride, clearOverride } = useCpuVendor();

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
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage(categories);

  // The RAM ladder is one script per capacity; only the tier that matches the
  // installed memory is listed, as before. RAM scripts only exist in the CPU
  // category, so this filter cannot touch the GPU/Windows sections.
  const cpuScripts = useMemo(() => {
    return categoryScripts.filter((s) => {
      if (s.subcategory === 'RAM') {
        return s.id === recommendedRamScriptId;
      }
      return true;
    });
  }, [categoryScripts, recommendedRamScriptId]);

  // Each section is fed by a catalog category, so a script can never be filed
  // under a section about different hardware (an AMD GPU tweak can't show up as
  // a universal CPU tweak).
  const sections = useMemo(
    () =>
      PERFORMANCE_SECTIONS.map((section) => {
        const scripts =
          section.category === CPU_CATEGORY
            ? cpuScripts
            : categoryScripts.filter((s) => s.category === section.category);
        return {
          section: { ...section, scriptIds: scripts.map((s) => s.id) },
          scripts,
        };
      }),
    [categoryScripts, cpuScripts]
  );

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
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent',
          TONE_BORDER[tone],
          TONE_BG_FAINT[tone]
        )}
      >
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Cpu className={cn('size-28', TONE_TEXT[tone])} />
        </div>
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className={cn('size-4', TONE_TEXT[tone])} />
                <span
                  className={cn('text-xs font-semibold uppercase tracking-wider', TONE_TEXT[tone])}
                >
                  Desempenho · {vendorLabel}
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground">Desempenho do PC</h2>
              <p className="text-sm text-muted-foreground mt-1">{cpuModel ?? '—'}</p>
            </div>
            <Badge variant="secondary" className={cn('text-xs px-3 py-1', TONE_BADGE[tone])}>
              {categoryScripts.length} tweaks
            </Badge>
          </div>
        </div>
      </div>

      {/* CPU Info Card */}
      <Card className={cn('border', TONE_BORDER[tone])}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={cn('flex size-10 items-center justify-center rounded-lg', TONE_BG[tone])}
            >
              <Cpu className={cn('size-5', TONE_TEXT[tone])} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Processador</p>
              <p className="text-sm font-medium">{cpuModel ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Núcleos</p>
              <p className="text-sm font-medium">
                {cpuState.status === 'success' ? cpuState.data.cores : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Threads</p>
              <p className="text-sm font-medium">
                {cpuState.status === 'success' ? cpuState.data.logicalProcessors : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">RAM</p>
              <p className="text-sm font-medium">{ramAmount ? `${ramAmount} GB` : '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Uso</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  cpuState.status === 'success' && cpuState.data.usage > 80
                    ? 'text-red-400'
                    : cpuState.status === 'success' && cpuState.data.usage > 50
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                )}
              >
                {cpuState.status === 'success'
                  ? `${cpuState.data.usage}% ${
                      cpuState.data.usage > 80
                        ? '(Alto)'
                        : cpuState.data.usage > 50
                          ? '(Médio)'
                          : '(Normal)'
                    }`
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor notice: unidentified CPU, or a manual override in effect */}
      {isUnidentified && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0 text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Processador não identificado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {cpuModel
                  ? `Nenhum fabricante Intel ou AMD reconhecido em "${cpuModel}". `
                  : 'Nenhum fabricante Intel ou AMD reconhecido. '}
                A identificação só define o rótulo desta página: os ajustes de processador valem
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
              tone === 'red' ? 'bg-red-400' : tone === 'blue' ? 'bg-blue-400' : 'bg-yellow-400'
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
            {sections
              .filter(({ scripts }) => scripts.length > 0)
              .map(({ section, scripts }) => (
                <ScriptSectionCard
                  key={section.id}
                  section={section}
                  scripts={scripts}
                  activeExecution={activeExecution}
                  onCancel={handleCancel}
                  onConfirmExecute={handleConfirmExecute}
                />
              ))}
          </div>
        )}
      </div>

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
