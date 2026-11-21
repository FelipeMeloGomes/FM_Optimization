import type { LucideIcon } from 'lucide-react';
import { memo, type ReactNode, useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { ConfirmBulkScriptDialog } from './ConfirmBulkScriptDialog';
import { HeroBanner } from './hero/HeroBanner';
import { ScriptCardSkeleton } from './ScriptCardSkeleton';
import { ScriptSelectionToolbar } from './ScriptSelectionToolbar';
import { VirtualizedScriptList } from './VirtualizedScriptList';

export interface TweaksPageHero {
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  visual: ReactNode;
}

export interface TweaksPageProps {
  /** Categoria (ou categorias) repassada a `useScriptPage`. */
  category: string | string[];
  /** Texto e visual do banner. Defina fora do componente para manter a prop estável. */
  hero: TweaksPageHero;
  /** Quantidade de esqueletos no carregamento. */
  skeletonCount: number;
  /** Input Lag usava `gap-3` no grid de esqueletos; as demais, `gap-4`. */
  skeletonGap?: string;
  /** A CPU usava `h-32` no esqueleto do hero; as demais, `h-24`. */
  skeletonHeroHeight?: string;
  /** Filtra e/ou reordena os scripts da categoria antes da lista e da seleção. */
  transform?: (scripts: ScriptEntry[]) => ScriptEntry[];
  /** Nomes e descrições curados, quando o catálogo não serve para a lista. */
  buildLabels?: (scripts: ScriptEntry[]) => Record<string, { name: string; description: string }>;
  /** Conteúdo extra entre o hero e a barra (avisos da CPU, cabeçalho de Input Lag). */
  beforeList?: (visibleScripts: ScriptEntry[]) => ReactNode;
  /** CPU também espera a leitura do hardware antes de mostrar a lista. */
  extraLoading?: boolean;
  /** Input Lag e CPU embrulham barra + lista em `space-y-4`; as demais usam o `space-y-6` raiz. */
  compactToolbarGap?: boolean;
}

/**
 * Layout único das páginas de tweaks no padrão da Limpeza: hero, barra de
 * seleção, lista virtualizada e confirmação de lote. O componente é dono dos
 * hooks de página e de seleção para que nenhuma página precise copiar o template.
 * Memoizado para que mudanças de estado de uma página não re-renderizem a lista
 * das outras quando as props são estáveis.
 */
function TweaksPageImpl({
  category,
  hero,
  skeletonCount,
  skeletonGap = 'gap-4',
  skeletonHeroHeight = 'h-24',
  transform,
  buildLabels,
  beforeList,
  extraLoading = false,
  compactToolbarGap = false,
}: TweaksPageProps) {
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
  } = useScriptPage(category);

  const visibleScripts = useMemo(
    () => (transform ? transform(categoryScripts) : categoryScripts),
    [transform, categoryScripts]
  );
  const labels = useMemo(
    () => (buildLabels ? buildLabels(categoryScripts) : undefined),
    [buildLabels, categoryScripts]
  );

  const { selectedIds, selectedScripts, toggle, selectAll, clear } =
    useScriptSelection(visibleScripts);
  const disabled = !!batch;

  if (extraLoading || state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className={`${skeletonHeroHeight} rounded-xl bg-muted animate-pulse`} />
        <div className={`grid grid-cols-1 ${skeletonGap} sm:grid-cols-2`}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
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

  const Icon = hero.icon;
  const toolbar = (
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
  );
  const list = (
    <VirtualizedScriptList
      scripts={visibleScripts}
      labels={labels}
      activeExecution={activeExecution}
      onCancel={handleCancel}
      selectedIds={selectedIds}
      onToggle={toggle}
      disabled={disabled}
    />
  );

  return (
    <div className="space-y-6">
      <HeroBanner visual={hero.visual}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {hero.badge}
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">{hero.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">{hero.description}</p>
        </div>
      </HeroBanner>

      {beforeList?.(visibleScripts)}

      {compactToolbarGap ? (
        <div className="space-y-4">
          {toolbar}
          {list}
        </div>
      ) : (
        <>
          {toolbar}
          {list}
        </>
      )}

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

export const TweaksPage = memo(TweaksPageImpl);
