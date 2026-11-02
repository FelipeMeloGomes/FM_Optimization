import { Palette } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScriptCardSkeleton } from '../components/ScriptCardSkeleton';
import { ScriptSectionCard } from '../components/ScriptSectionCard';
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
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Palette className="size-28 text-primary" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Personalização
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Aparência do Windows</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Ajuste a barra de tarefas, o menu de contexto e os efeitos visuais. Estes scripts
            personalizam a interface — não removem programas nem alteram a proteção do sistema.
          </p>
        </div>
      </div>

      {/* Personalization Sections */}
      {PERSONALIZATION_SECTIONS.map((section) => (
        <ScriptSectionCard
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
