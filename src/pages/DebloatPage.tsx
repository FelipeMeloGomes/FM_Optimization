import { Loader2, Lock, Package, PackageX, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppxPackageInfo } from '../../electron/shared/ipc-types';
import { ConfirmRemoveAppsDialog } from '../components/ConfirmRemoveAppsDialog';
import { showEnhancedToast } from '../components/EnhancedToast';
import { HeroBanner } from '../components/hero/HeroBanner';
import { PageSkeleton } from '../components/PageSkeleton';
import { PageRefreshBar } from '../components/RefreshButton';
import { AdminNotice, Button, ErrorPanel, SearchInput, Tabs } from '../components/ui';
import { VirtualSpacer } from '../components/VirtualSpacer';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useAdminStatus } from '../hooks/use-admin-status';
import { useAppxInventory } from '../hooks/use-appx-inventory';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import { HERO_ART } from '../lib/hero-art';
import { cn } from '../lib/utils';
import { plural } from '../utils/format';

const APP_ROW_HEIGHT = 69;

type TabId = 'all' | 'recommended' | 'protected';

import { toErrorMessage } from '../../electron/shared/errors';

function matchesQuery(app: AppxPackageInfo, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return (
    app.displayName.toLowerCase().includes(needle) ||
    app.packageName.toLowerCase().includes(needle) ||
    app.familyName.toLowerCase().includes(needle)
  );
}

function isInTab(app: AppxPackageInfo, tab: TabId): boolean {
  if (tab === 'recommended') return app.recommended;
  if (tab === 'protected') return !app.removable;
  // Componentes de sistema (inclusive pacotes com nome GUID) ficam só na aba
  // Protegidos: a aba Todos mostra o que a pessoa pode realmente remover.
  return app.removable;
}

/**
 * Página Debloat: inventário dos apps Appx do Windows, um por linha.
 *
 * A lista mostra todos os apps (Store, UWP e componentes), mas apps de sistema,
 * frameworks e `NonRemovable` aparecem com cadeado e sem checkbox. A remoção
 * vai para o main só como PackageFamilyName; o main resolve os nomes e recusa
 * protegidos mesmo que a UI insista.
 */
export default function DebloatPage() {
  const { inventory, loading, error, isRefreshing, lastRefreshed, refresh, remove } =
    useAppxInventory();
  const { settings } = useSettingsContext();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabId>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const packages = inventory?.packages ?? [];
  const { isAdmin, elevating, relaunchAsAdmin } = useAdminStatus({
    soundEnabled: settings.soundEnabled,
    externalIsAdmin: inventory?.elevated ?? false,
  });

  // Uma nova varredura pode remover um app da lista: não deixe uma seleção
  // órfã habilitar o botão de remover.
  useEffect(() => {
    setSelected((previous) => {
      const selectable = new Set(
        packages.filter((app) => app.removable).map((app) => app.familyName)
      );
      const next = [...previous].filter((family) => selectable.has(family));
      return next.length === previous.size ? previous : new Set(next);
    });
  }, [packages]);

  const searched = useMemo(
    () => packages.filter((app) => matchesQuery(app, query.trim())),
    [packages, query]
  );
  const visible = useMemo(() => searched.filter((app) => isInTab(app, tab)), [searched, tab]);

  const listRef = useRef<HTMLUListElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    visible,
    null,
    APP_ROW_HEIGHT,
    listRef
  );

  const counts = useMemo(
    () => ({
      all: packages.filter((app) => app.removable).length,
      recommended: packages.filter((app) => app.recommended).length,
      protected: packages.filter((app) => !app.removable).length,
    }),
    [packages]
  );

  const selectedApps = useMemo(
    () => packages.filter((app) => selected.has(app.familyName)),
    [packages, selected]
  );

  const toggle = useCallback((familyName: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(familyName)) next.delete(familyName);
      else next.add(familyName);
      return next;
    });
  }, []);

  const selectRecommended = useCallback(() => {
    const recommended = packages.filter((app) => app.recommended && app.removable);
    if (recommended.length === 0) {
      showEnhancedToast({
        type: 'info',
        title: 'Nenhum app recomendado',
        description: 'Os apps da lista curada não estão instalados neste Windows.',
        duration: 'medium',
        sound: settings.soundEnabled,
      });
      return;
    }
    setSelected(new Set(recommended.map((app) => app.familyName)));
  }, [packages, settings.soundEnabled]);

  const runRemove = useCallback(
    async (families: string[]) => {
      setConfirmOpen(false);
      setRemoving(true);
      try {
        const result = await remove(families);
        setSelected(new Set());

        const names = result.failed.map(
          (failure) =>
            packages.find((app) => app.familyName === failure.familyName)?.displayName ??
            failure.familyName
        );

        if (result.failed.length > 0) {
          showEnhancedToast({
            type: 'warning',
            title: result.removed.length > 0 ? 'Remoção parcial' : 'Nenhum app removido',
            description: `${plural(result.removed.length, 'app removido', 'apps removidos')}${
              names.length > 0 ? ` · Falhou: ${names.join(', ')}` : ''
            }. Alguns apps podem ser reinstalados pelo Windows.`,
            duration: 'long',
            sound: settings.soundEnabled,
          });
        } else {
          showEnhancedToast({
            type: 'success',
            title: 'Apps removidos',
            description: `${plural(result.removed.length, 'app removido', 'apps removidos')} do Windows.`,
            duration: 'long',
            sound: settings.soundEnabled,
          });
        }
      } catch (e) {
        showEnhancedToast({
          type: 'error',
          title: 'Falha ao remover apps',
          description: toErrorMessage(e),
          duration: 'long',
          sound: settings.soundEnabled,
        });
      } finally {
        setRemoving(false);
      }
    },
    [remove, packages, settings.soundEnabled]
  );

  const requestRemove = useCallback(() => {
    if (selectedApps.length === 0 || removing || !isAdmin) return;
    const families = selectedApps.map((app) => app.familyName);
    if (settings.confirmOnExecute) {
      setConfirmOpen(true);
      return;
    }
    void runRemove(families);
  }, [selectedApps, removing, isAdmin, settings.confirmOnExecute, runRemove]);

  if (loading) {
    return <PageSkeleton layout="list" count={7} label="Carregando aplicativos…" />;
  }

  if (error && packages.length === 0) {
    return (
      <ErrorPanel
        title="Erro ao carregar o inventário de apps"
        message={error}
        className="gap-2 text-muted-foreground"
        icon={false}
        retryLabel="Tentar de novo"
        onRetry={() => void refresh()}
      />
    );
  }

  const tabs = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'recommended', label: 'Recomendados', count: counts.recommended },
    { id: 'protected', label: 'Protegidos', count: counts.protected },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner
        {...HERO_ART['/debloat']}
        badge="Debloat"
        path="/debloat"
        title="Debloat de apps do Windows"
        description="Inventário dos apps Appx instalados e provisionados. A aba Todos mostra o que pode ser removido; apps de sistema, frameworks e componentes com nome GUID ficam na aba Protegidos."
      />

      <PageRefreshBar
        onRefresh={() => void refresh()}
        refreshing={isRefreshing}
        ariaLabel="Atualizar inventário"
        status={lastRefreshed > 0 ? 'A varredura usa PowerShell e pode levar até 1 minuto.' : null}
      />

      {error && packages.length > 0 && (
        <ErrorPanel
          variant="inline"
          title="Não foi possível atualizar o inventário"
          message={error}
          messageSeparator=": "
          className="flex-wrap px-3 py-2"
          titleClassName="text-xs"
          messageClassName="text-xs"
          icon={false}
          retryLabel="Tentar de novo"
          retryVariant="ghost"
          onRetry={() => void refresh()}
        />
      )}

      {!isAdmin && (
        <AdminNotice
          compact
          icon={<Lock className="size-4 shrink-0 text-warning" aria-hidden="true" />}
          message={
            <p className="flex-1 text-xs text-warning">
              Remover apps precisa de administrador. O inventário continua visível para consulta.
            </p>
          }
          relaunching={elevating}
          onRelaunch={() => void relaunchAsAdmin()}
        />
      )}

      <section aria-label="Apps do Windows" className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            ariaLabel="Buscar apps"
            wrapperClassName="w-full sm:max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou pacote…"
          />
          <Tabs
            ariaLabel="Categorias de aplicativos"
            items={tabs}
            value={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="subtle" size="sm" onClick={selectRecommended} className="gap-1.5">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Selecionar recomendados
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {selected.size === 0
                ? 'Nenhum selecionado'
                : plural(selected.size, 'selecionado', 'selecionados')}
            </span>
          </div>
          <Button
            size="sm"
            onClick={requestRemove}
            disabled={selectedApps.length === 0 || removing || !isAdmin}
            className="gap-1.5"
          >
            {removing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Removendo…
              </>
            ) : (
              <>
                <PackageX className="size-3.5" aria-hidden="true" />
                Remover selecionados
              </>
            )}
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum app encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajuste a busca ou troque de aba para ver outros apps.
            </p>
          </div>
        ) : (
          <div
            data-testid="apps-list"
            className="relative overflow-hidden rounded-xl border border-border bg-card"
          >
            {paddingTop > 0 && <VirtualSpacer height={paddingTop} testId="virtual-spacer-top" />}
            <ul ref={listRef} className="divide-y divide-border">
              {virtualItems.map((virtualRow) => {
                const app = visible[virtualRow.index];
                const locked = !app.removable;
                const checked = selected.has(app.familyName);
                const checkboxId = `appx-${app.familyName}`;

                const rowContent = (
                  <>
                    {locked ? (
                      <span
                        title={app.protectionReason ?? 'App protegido'}
                        className="flex size-4 shrink-0 items-center justify-center"
                      >
                        <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    ) : (
                      <input
                        id={checkboxId}
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => toggle(app.familyName)}
                        disabled={removing}
                        aria-label={`Selecionar ${app.displayName}`}
                      />
                    )}

                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        locked ? 'bg-muted' : 'bg-primary/10'
                      )}
                    >
                      <Package
                        className={cn('size-4', locked ? 'text-muted-foreground' : 'text-primary')}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {app.displayName}
                        </span>
                        {app.recommended && (
                          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                            Recomendado
                          </span>
                        )}
                        {app.isProvisioned && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            Provisão
                          </span>
                        )}
                        {locked && (
                          <span className="shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning">
                            Protegido
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {app.packageName}
                      </span>
                    </div>

                    <span className="shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                      {app.version || '—'}
                    </span>
                  </>
                );

                const rowClass = cn(
                  'flex w-full items-center gap-3 px-4 py-3 transition-colors',
                  !locked && !removing && 'cursor-pointer hover:bg-muted/40',
                  locked && 'opacity-70',
                  checked && 'bg-primary/5'
                );

                // Label associa a linha inteira ao checkbox: clicar no nome ou no
                // ícone seleciona, e o clique no próprio checkbox não duplica.
                return (
                  <li key={app.familyName} data-index={virtualRow.index} ref={measureElement}>
                    {locked ? (
                      <div className={rowClass}>{rowContent}</div>
                    ) : (
                      <label htmlFor={checkboxId} className={rowClass}>
                        {rowContent}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            {paddingBottom > 0 && (
              <VirtualSpacer height={paddingBottom} testId="virtual-spacer-bottom" />
            )}
          </div>
        )}
      </section>

      <ConfirmRemoveAppsDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        apps={selectedApps}
        onConfirm={() => void runRemove(selectedApps.map((app) => app.familyName))}
      />
    </div>
  );
}
