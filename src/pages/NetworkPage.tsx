import { Wifi } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AnimatedNetwork } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { NETWORK_SECTIONS } from '../lib/network-sections';

/**
 * A configuração visual de DNS saiu daqui para `DnsPage` (/dns). Esta página
 * mantém só os scripts de rede, apresentados no mesmo padrão das demais:
 * seções em `VirtualizedSectionCard` + diálogo de confirmação do hook.
 */
export default function NetworkPage() {
  const {
    state,
    categoryScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage(['Internet', 'DNS Manager']);

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

      {/* Network Sections */}
      {NETWORK_SECTIONS.map((section) => (
        <VirtualizedSectionCard
          key={section.id}
          section={section}
          scripts={categoryScripts}
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
