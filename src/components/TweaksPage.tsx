import { memo, type ReactNode, useMemo } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { useScriptPage } from '../hooks/use-script-page';
import { useScriptSelection } from '../hooks/use-script-selection';
import { ConfirmBulkScriptDialog } from './ConfirmBulkScriptDialog';
import { HeroBanner } from './hero/HeroBanner';
import { PageSkeleton } from './PageSkeleton';
import { ScriptSelectionToolbar } from './ScriptSelectionToolbar';
import { Button } from './ui';
import { VirtualizedScriptList } from './VirtualizedScriptList';

export interface TweaksPageHero {
  /** Path da rota: o ícone do badge vem da sidebar, sem escolha na página. */
  path: string;
  badge: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

export interface TweaksPageProps {
  /** Categoria (ou categorias) repassada a `useScriptPage`. */
  category: string | string[];
  /** Texto e visual do banner. Defina fora do componente para manter a prop estável. */
  hero: TweaksPageHero;
  /** Linhas no esqueleto; use a quantidade real de scripts da página. */
  skeletonCount?: number;
  /** Filtra e/ou reordena os scripts da categoria antes da lista e da seleção. */
  transform?: (scripts: ScriptEntry[]) => ScriptEntry[];
  /** Nomes e descrições curados, quando o catálogo não serve para a lista. */
  buildLabels?: (scripts: ScriptEntry[]) => Record<string, { name: string; description: string }>;
  /** Conteúdo extra entre o hero e a barra (avisos da CPU, cabeçalho de Input Lag). */
  beforeList?: (visibleScripts: ScriptEntry[]) => ReactNode;
  /** Conteúdo acima de todos os estados, inclusive carregamento e erro. */
  beforeContent?: ReactNode;
  /** Substitui o HeroBanner padrão quando a página usa outro banner. */
  heroContent?: ReactNode;
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
  transform,
  buildLabels,
  beforeList,
  beforeContent,
  heroContent,
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
    reloadScripts,
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
  const withBeforeContent = (content: ReactNode) => (
    <>
      {beforeContent}
      {content}
    </>
  );

  if (extraLoading || state.status === 'loading') {
    return withBeforeContent(
      <PageSkeleton layout="tweaks" count={skeletonCount} label="Carregando ajustes…" />
    );
  }

  if (state.status === 'error') {
    return withBeforeContent(
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar tweaks</p>
        <p className="text-xs text-destructive">{state.error}</p>
        <Button variant="outline" size="sm" onClick={reloadScripts}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  // O banner vem antes do painel de ajustes; o painel continua visível em
  // loading/erro através de `withBeforeContent`, onde não há banner.
  const banner = heroContent ?? (
    <HeroBanner
      image={hero.image}
      imageAlt={hero.imageAlt}
      badge={hero.badge}
      path={hero.path}
      title={hero.title}
      description={hero.description}
    />
  );
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
      {banner}
      {beforeContent}
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
