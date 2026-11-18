import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Eraser,
  FolderOpen,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CleanerItemId } from '../../electron/shared/cleaner-items';
import type { CleanerItemStats } from '../../electron/shared/ipc-types';
import { ConfirmCleanDialog } from '../components/ConfirmCleanDialog';
import { showEnhancedToast } from '../components/EnhancedToast';
import { Button } from '../components/ui';
import { useAutoCleanContext } from '../contexts/AutoCleanContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useCleanerItems } from '../hooks/use-cleaner-items';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import { cleanerName } from '../lib/cleaner-options';
import { cn } from '../lib/utils';
import { formatBytes } from '../utils/format';

const LARGE_CLEANUP_THRESHOLD_BYTES = 1024 * 1024 * 1024;
const SKELETON_ROWS = 6;
const CLEANER_ROW_HEIGHT = 72;

/** Limpezas seguras e reversíveis: temporários, prefetch e cache de navegador. */
const RECOMMENDED_ITEM_IDS: ReadonlySet<CleanerItemId> = new Set([
  'temp-user',
  'temp-windows',
  'prefetch',
  'chrome',
  'edge',
  'firefox',
  'brave',
]);

const ITEM_ICONS: Record<CleanerItemId, LucideIcon> = {
  'temp-user': FolderOpen,
  'temp-windows': FolderOpen,
  prefetch: Zap,
  'windows-update': RefreshCw,
  directx: Boxes,
  chrome: Globe,
  edge: Globe,
  firefox: Globe,
  brave: Globe,
};

function iconFor(item: CleanerItemStats): LucideIcon {
  return ITEM_ICONS[item.id] ?? FolderOpen;
}

function formatTimeSince(timestamp: number): string {
  if (timestamp === 0) return '';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin === 1) return 'há 1 min';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH === 1) return 'há 1 hora';
  if (diffH < 24) return `há ${diffH} horas`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'há 1 dia';
  return `há ${diffD} dias`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function CleanerPage() {
  const { items, loading, error, isRefreshing, lastRefreshed, refresh, clean } = useCleanerItems();

  const { settings } = useSettingsContext();

  const {
    status: autoCleanStatus,
    runPending: runAutoCleanPending,
    discard: discardPending,
    relaunchAsAdmin,
  } = useAutoCleanContext();
  const pendingCleaners = autoCleanStatus?.settings.pending ?? [];
  const autoCleanRunning = autoCleanStatus?.running ?? false;
  const autoCleanIsAdmin = autoCleanStatus?.isAdmin ?? false;
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminKnown, setAdminKnown] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleaningIds, setCleaningIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    items,
    null,
    CLEANER_ROW_HEIGHT,
    listRef
  );

  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      .isAdmin()
      .then((value) => {
        if (cancelled) return;
        setIsAdmin(value);
        setAdminKnown(true);
      })
      .catch(() => {
        if (!cancelled) setAdminKnown(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onScriptEnded((data) => {
      // A limpeza agendada é anunciada pelo AutoCleanProvider; aqui só importa
      // que os números exibidos deixem de estar velhos.
      if (data.code === 0) void refresh();
    });
    return cleanup;
  }, [refresh]);

  const canCleanItem = useCallback(
    (item: CleanerItemStats) => item.totalSizeBytes > 0 && (!item.requiresAdmin || isAdmin),
    [isAdmin]
  );

  const selectableItems = useMemo(
    () => items.filter((item) => canCleanItem(item)),
    [items, canCleanItem]
  );

  // A seleção inicial só pode acontecer depois que sabemos se o app está
  // elevado: sem isso, os itens de sistema seriam desmarcados por engano.
  useEffect(() => {
    if (selectionInitialized || loading || !adminKnown) return;
    setSelected(new Set(selectableItems.map((item) => item.id)));
    setSelectionInitialized(true);
  }, [selectionInitialized, loading, adminKnown, selectableItems]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected]
  );
  const selectedBytes = selectedItems.reduce((total, item) => total + item.totalSizeBytes, 0);
  const selectedFiles = selectedItems.reduce((total, item) => total + item.fileCount, 0);

  const allSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selected.has(item.id));
  const hasSelectableItems = selectableItems.length > 0;

  const totalStats = useMemo(() => {
    let totalFiles = 0;
    let totalBytes = 0;
    for (const item of items) {
      totalFiles += item.fileCount;
      totalBytes += item.totalSizeBytes;
    }
    return { totalFiles, totalBytes };
  }, [items]);

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (selectableItems.length > 0 && selectableItems.every((item) => prev.has(item.id))) {
        return new Set();
      }
      return new Set(selectableItems.map((item) => item.id));
    });
  }, [selectableItems]);

  const selectRecommended = useCallback(() => {
    const recommended = selectableItems.filter((item) => RECOMMENDED_ITEM_IDS.has(item.id));
    if (recommended.length === 0) {
      showEnhancedToast({
        type: 'info',
        title: 'Nenhum item recomendado',
        description: 'Os itens recomendados não têm dados para limpar neste Windows.',
        duration: 'medium',
        sound: settings.soundEnabled,
      });
      return;
    }
    setSelected(new Set(recommended.map((item) => item.id)));
  }, [selectableItems, settings.soundEnabled]);

  const runClean = useCallback(
    async (ids: CleanerItemId[]) => {
      setConfirmOpen(false);
      setCleaning(true);
      setCleaningIds(ids);

      try {
        const result = await clean(ids);
        await refresh();
        setSelected(new Set());

        const failedLabels = result.items
          .filter((item) => item.error !== undefined)
          .map((item) => item.label);

        if (result.freedBytes > 0) {
          showEnhancedToast({
            type: failedLabels.length > 0 ? 'warning' : 'success',
            title: 'Limpeza concluída',
            description: `Liberado: ${formatBytes(result.freedBytes)} em ${result.removedFiles.toLocaleString('pt-BR')} arquivos${
              failedLabels.length > 0 ? ` · Falhou: ${failedLabels.join(', ')}` : ''
            }`,
            duration: 'long',
            sound: settings.soundEnabled,
          });
        } else if (failedLabels.length > 0) {
          showEnhancedToast({
            type: 'error',
            title: 'Limpeza incompleta',
            description: `Não foi possível limpar: ${failedLabels.join(', ')}`,
            duration: 'long',
            sound: settings.soundEnabled,
          });
        } else {
          showEnhancedToast({
            type: 'info',
            title: 'Nada para liberar',
            description: 'Os itens selecionados já estavam limpos',
            duration: 'medium',
            sound: settings.soundEnabled,
          });
        }
      } catch (e) {
        showEnhancedToast({
          type: 'error',
          title: 'Falha na limpeza',
          description: errorMessage(e),
          duration: 'long',
          sound: settings.soundEnabled,
        });
      } finally {
        setCleaning(false);
        setCleaningIds([]);
      }
    },
    [clean, refresh, settings.soundEnabled]
  );

  const requestClean = useCallback(() => {
    if (selectedItems.length === 0 || cleaning) return;
    const ids = selectedItems.map((item) => item.id);
    if (settings.confirmOnExecute) {
      setConfirmOpen(true);
      return;
    }
    void runClean(ids);
  }, [selectedItems, cleaning, settings.confirmOnExecute, runClean]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" role="status">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
              key={`cleaner-row-skeleton-${index}`}
              className="h-10 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground"
        role="alert"
      >
        <p className="text-sm">Erro ao carregar itens de limpeza</p>
        <p className="text-xs text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingCleaners.length > 0 && (
        <section
          aria-label="Limpezas pendentes"
          className="rounded-xl border border-warning/20 bg-warning/5 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-warning">
                {pendingCleaners.length} limpeza(s) automática(s) aguardando administrador
              </p>
              <ul className="flex flex-wrap gap-2">
                {pendingCleaners.map((id) => (
                  <li key={id}>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/50 py-0.5 pl-2 pr-1 text-xs text-foreground">
                      {cleanerName(id)}
                      <button
                        type="button"
                        aria-label={`Descartar pendência de ${cleanerName(id)}`}
                        onClick={() => void discardPending([id])}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:pl-7">
            <Button
              size="sm"
              onClick={() => void runAutoCleanPending()}
              disabled={autoCleanRunning}
              className="gap-1.5"
            >
              Executar agora
            </Button>
            {!autoCleanIsAdmin && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void relaunchAsAdmin()}
                className="gap-1.5"
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Reiniciar como admin
              </Button>
            )}
            <Button
              size="sm"
              variant={confirmDiscardAll ? 'destructive' : 'ghost'}
              onClick={() => {
                if (confirmDiscardAll) {
                  void discardPending(pendingCleaners);
                  setConfirmDiscardAll(false);
                  return;
                }
                setConfirmDiscardAll(true);
              }}
              onBlur={() => setConfirmDiscardAll(false)}
            >
              {confirmDiscardAll ? 'Confirmar descarte' : 'Descartar todas'}
            </Button>
          </div>
        </section>
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Eraser className="size-28 text-primary" aria-hidden="true" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eraser className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Limpeza
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Mantenha seu Windows limpo e rápido
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Escolha o que limpar, item por item, e libere espaço sem mexer no que você usa.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              aria-label="Atualizar estatísticas"
              className="shrink-0 gap-1.5"
            >
              <RefreshCw
                className={cn('size-3.5', isRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span className="text-xs">{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </Button>
          </div>
          {lastRefreshed > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Atualizado {formatTimeSince(lastRefreshed)}
              {totalStats.totalFiles > 0 && (
                <span className="ml-2">
                  · {totalStats.totalFiles.toLocaleString('pt-BR')} arquivos ·{' '}
                  {formatBytes(totalStats.totalBytes)} totais para limpar
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {cleaning
          ? 'Limpando itens selecionados...'
          : isRefreshing
            ? 'Atualizando estatísticas...'
            : lastRefreshed > 0
              ? 'Estatísticas atualizadas'
              : ''}
      </div>

      {error && items.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
        >
          <p className="flex-1 text-xs text-destructive">
            Não foi possível atualizar as estatísticas: {error}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!isAdmin && items.some((item) => item.requiresAdmin) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
          <Lock className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="flex-1 text-xs text-warning">
            Itens com cadeado exigem administrador para serem limpos.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void relaunchAsAdmin()}
            className="gap-1.5"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Reiniciar como admin
          </Button>
        </div>
      )}

      <section aria-label="Itens de limpeza" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allSelected}
                onChange={toggleAll}
                disabled={!hasSelectableItems || cleaning}
              />
              Selecionar todos
              <span className="text-xs text-muted-foreground">
                {selected.size} de {selectableItems.length} selecionados
              </span>
            </label>
            <Button variant="subtle" size="sm" onClick={selectRecommended} className="gap-1.5">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Selecionar recomendados
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(selectedBytes)} · {selectedFiles.toLocaleString('pt-BR')} arquivos
            </span>
            <Button
              size="sm"
              onClick={requestClean}
              disabled={selectedItems.length === 0 || cleaning}
              className="gap-1.5"
            >
              {cleaning ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Limpar selecionados
                </>
              )}
            </Button>
          </div>
        </div>

        <div
          data-testid="cleaner-list"
          className="relative overflow-hidden rounded-xl border border-border bg-card"
        >
          {paddingTop > 0 && (
            <div
              data-testid="virtual-spacer-top"
              style={{ height: paddingTop }}
              aria-hidden="true"
            />
          )}
          <ul ref={listRef} className="divide-y divide-border">
            {virtualItems.map((virtualRow) => {
              const item = items[virtualRow.index];
              const Icon = iconFor(item);
              const hasData = item.fileCount > 0;
              const canSelect = canCleanItem(item);
              const locked = item.requiresAdmin && !isAdmin;
              const isWorking = cleaningIds.includes(item.id);
              const isLarge = item.totalSizeBytes > LARGE_CLEANUP_THRESHOLD_BYTES;
              const checkboxId = `clean-item-${item.id}`;

              return (
                <li
                  key={item.id}
                  ref={measureElement}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    canSelect && !cleaning && 'hover:bg-muted/40',
                    !canSelect && 'opacity-60',
                    isWorking && 'bg-primary/5'
                  )}
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={selected.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    disabled={!canSelect || cleaning}
                    aria-label={`Selecionar ${item.label}`}
                  />

                  <label
                    htmlFor={checkboxId}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3',
                      canSelect && 'cursor-pointer'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        item.error ? 'bg-destructive/10' : 'bg-muted'
                      )}
                    >
                      {isWorking ? (
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      ) : (
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        {isLarge && (
                          <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-medium text-warning">
                            Grande
                          </span>
                        )}
                        {locked && (
                          <span
                            title="Requer administrador"
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning"
                          >
                            <Lock className="size-2.5" aria-hidden="true" />
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {item.error ? 'Não foi possível medir este item' : item.description}
                      </span>
                    </span>
                  </label>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums text-foreground">
                      {hasData ? formatBytes(item.totalSizeBytes) : '—'}
                    </span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {item.error
                        ? 'Erro na leitura'
                        : hasData
                          ? `${item.fileCount.toLocaleString('pt-BR')} ${
                              item.fileCount === 1 ? 'arquivo' : 'arquivos'
                            }`
                          : 'Nada para limpar'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {paddingBottom > 0 && (
            <div
              data-testid="virtual-spacer-bottom"
              style={{ height: paddingBottom }}
              aria-hidden="true"
            />
          )}
        </div>
      </section>

      <ConfirmCleanDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        items={selectedItems}
        totalBytes={selectedBytes}
        onConfirm={() => void runClean(selectedItems.map((item) => item.id))}
      />
    </div>
  );
}
