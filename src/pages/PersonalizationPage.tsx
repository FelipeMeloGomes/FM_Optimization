import { Palette } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AnimatedPersonalization } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { VirtualizedSectionCard } from '../components/VirtualizedSectionCard';
import { useScriptPage } from '../hooks/use-script-page';
import { PERSONALIZATION_SECTIONS } from '../lib/personalization-sections';

export default function PersonalizationPage() {
  const {
    state,
    categoryScripts: personalizationScripts,
    activeExecution,
    handleCancel,
    handleConfirmExecute,
    confirmScript,
    setConfirmScript,
    handleConfirm,
  } = useScriptPage('Personalização');

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PERSONALIZATION_SECTIONS.length }).map((_, i) => (
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

      {/* Personalization Sections */}
      {PERSONALIZATION_SECTIONS.map((section) => (
        <VirtualizedSectionCard
          key={section.id}
          section={section}
          scripts={personalizationScripts}
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
