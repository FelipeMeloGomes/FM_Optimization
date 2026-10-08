import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RemovedApp } from '../../../electron/shared/ipc-types';
import { showEnhancedToast } from '../../components/EnhancedToast';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Progress,
} from '../../components/ui';
import { useEmulatorContext } from '../../contexts/EmulatorContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { APP_ICON_MAP } from '../../lib/app-icons';
import { BLOATWARE_PACKAGES, PRESETS, type PresetKey } from '../../lib/bloatware';
import { cn } from '../../lib/utils';
import type { EmulatorInstance } from '../../types/emulator';

type FilterType = 'all' | 'system' | 'user' | 'disabled';

interface AppListViewProps {
  emulatorName: string;
  instance: EmulatorInstance;
  deviceSerial: string;
  onBack: () => void;
}

export function AppListView({ emulatorName, instance, deviceSerial, onBack }: AppListViewProps) {
  const {
    listaApps,
    appsSelecionados,
    carregando,
    toggleAppSelection,
    clearSelection,
    setListaApps,
    setAppsSelecionados,
    setCarregando,
  } = useEmulatorContext();
  const { settings } = useSettingsContext();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removalProgress, setRemovalProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [removedApps, setRemovedApps] = useState<RemovedApp[]>([]);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setPresetsOpen(false);
      }
    }
    if (presetsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [presetsOpen]);

  const filteredApps = useMemo(() => {
    let result = listaApps;
    if (filter === 'system') result = result.filter((a) => a.isSystem);
    if (filter === 'user') result = result.filter((a) => !a.isSystem);
    if (filter === 'disabled') result = result.filter((a) => a.isDisabled);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) => a.packageName.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
      );
    }
    return result;
  }, [listaApps, filter, search]);

  const filterCounts = useMemo(
    () => ({
      all: listaApps.length,
      system: listaApps.filter((a) => a.isSystem).length,
      user: listaApps.filter((a) => !a.isSystem).length,
      disabled: listaApps.filter((a) => a.isDisabled).length,
    }),
    [listaApps]
  );

  const allSelected =
    filteredApps.length > 0 && filteredApps.every((a) => appsSelecionados.has(a.packageName));

  const selHasSystem = useMemo(
    () =>
      Array.from(appsSelecionados).some(
        (pkg) => listaApps.find((a) => a.packageName === pkg)?.isSystem
      ),
    [appsSelecionados, listaApps]
  );

  const handleRefresh = useCallback(async () => {
    setCarregando(true);
    try {
      const apps = await window.electronAPI.adbListApps(deviceSerial);
      setListaApps(apps);
    } catch {
      /* handled by IPC */
    } finally {
      setCarregando(false);
    }
  }, [deviceSerial, setListaApps, setCarregando]);

  const handleSelectBloatware = useCallback(() => {
    const selected = listaApps
      .filter((a) => BLOATWARE_PACKAGES.has(a.packageName))
      .map((a) => a.packageName);
    setAppsSelecionados(new Set(selected));
    setPresetsOpen(false);
  }, [listaApps, setAppsSelecionados]);

  const handlePreset = useCallback(
    (key: PresetKey) => {
      const preset = PRESETS[key];
      const presetPkgs = preset.packages as readonly string[];
      const selected = listaApps
        .filter((a) => presetPkgs.includes(a.packageName))
        .map((a) => a.packageName);
      setAppsSelecionados(new Set(selected));
      setPresetsOpen(false);
    },
    [listaApps, setAppsSelecionados]
  );

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      setAppsSelecionados(new Set(filteredApps.map((app) => app.packageName)));
    }
    setPresetsOpen(false);
  }, [allSelected, filteredApps, clearSelection, setAppsSelecionados]);

  const loadRemovedApps = useCallback(async () => {
    try {
      setRemovedApps(await window.electronAPI.adbListRemovedApps());
      setRestoreError(null);
    } catch {
      setRemovedApps([]);
    }
  }, []);

  const handleRemove = useCallback(async () => {
    const pkgs = Array.from(appsSelecionados);
    setRemoving(true);
    setRemovalProgress({ current: 0, total: pkgs.length });
    const failures: string[] = [];
    const noBackup: string[] = [];
    let uninstalledCount = 0;
    let disabledCount = 0;
    for (let i = 0; i < pkgs.length; i++) {
      setRemovalProgress({ current: i + 1, total: pkgs.length });
      try {
        const result = await window.electronAPI.adbRemoveApp({
          serial: deviceSerial,
          instanceId: instance.id,
          instanceName: instance.displayName || instance.name,
          arch: instance.arch,
          packageName: pkgs[i],
        });
        if (result.mode === 'disabled') disabledCount++;
        else uninstalledCount++;
        if (!result.hasBackup) {
          const label = listaApps.find((a) => a.packageName === pkgs[i])?.label ?? pkgs[i];
          noBackup.push(label);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const label = listaApps.find((a) => a.packageName === pkgs[i])?.label ?? pkgs[i];
        failures.push(`${label} (${errMsg})`);
      }
    }
    clearSelection();
    setConfirmOpen(false);
    setRemoving(false);
    setRemovalProgress(null);
    await loadRemovedApps();
    await handleRefresh();

    if (failures.length > 0) {
      showEnhancedToast({
        type: 'error',
        title: `${failures.length} ${failures.length === 1 ? 'app falhou' : 'apps falharam'}`,
        description: [
          uninstalledCount > 0
            ? `${uninstalledCount} removido${uninstalledCount !== 1 ? 's' : ''}`
            : null,
          disabledCount > 0
            ? `${disabledCount} desabilitado${disabledCount !== 1 ? 's' : ''}`
            : null,
          noBackup.length > 0 ? `${noBackup.length} sem backup (${noBackup.join(', ')})` : null,
          failures.join(' · '),
        ]
          .filter(Boolean)
          .join(' — '),
        duration: 'medium',
        sound: settings.soundEnabled,
      });
      return;
    }

    if (disabledCount > 0) {
      showEnhancedToast({
        type: 'success',
        title: 'Remoção concluída',
        description: [
          `${uninstalledCount} removido${uninstalledCount !== 1 ? 's' : ''} · ${disabledCount} desabilitado${disabledCount !== 1 ? 's' : ''} (protegidos)`,
          noBackup.length > 0 ? `${noBackup.length} sem backup (${noBackup.join(', ')})` : null,
        ]
          .filter(Boolean)
          .join(' — '),
        duration: 'medium',
        sound: settings.soundEnabled,
      });
      return;
    }

    showEnhancedToast({
      type: 'success',
      title: `${uninstalledCount} ${uninstalledCount === 1 ? 'app removido' : 'apps removidos'}`,
      description:
        noBackup.length > 0 ? `${noBackup.length} sem backup (${noBackup.join(', ')})` : undefined,
      duration: 'medium',
      sound: settings.soundEnabled,
    });
  }, [
    appsSelecionados,
    deviceSerial,
    instance,
    clearSelection,
    loadRemovedApps,
    handleRefresh,
    listaApps,
    settings.soundEnabled,
  ]);

  const handleRestoreRemoved = useCallback(
    async (app: RemovedApp) => {
      setRestoreBusy(true);
      setRestoreError(null);
      try {
        await window.electronAPI.adbRestoreRemovedApp({
          serial: deviceSerial,
          instanceId: app.instanceId,
          packageName: app.packageName,
        });
        showEnhancedToast({
          type: 'success',
          title: `${app.label} restaurado`,
          duration: 'medium',
          sound: settings.soundEnabled,
        });
        await loadRemovedApps();
        await handleRefresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRestoreError(msg);
        showEnhancedToast({
          type: 'error',
          title: 'Falha ao restaurar',
          description: msg,
          duration: 'medium',
          sound: settings.soundEnabled,
        });
      } finally {
        setRestoreBusy(false);
      }
    },
    [deviceSerial, loadRemovedApps, handleRefresh, settings.soundEnabled]
  );

  const handleClearRemoved = useCallback(
    async (app: RemovedApp) => {
      setRestoreBusy(true);
      try {
        await window.electronAPI.adbClearRemoved(app.packageName);
        await loadRemovedApps();
      } finally {
        setRestoreBusy(false);
      }
    },
    [loadRemovedApps]
  );

  const handleClearHistory = useCallback(async () => {
    setRestoreBusy(true);
    try {
      await window.electronAPI.adbClearRemovedHistory();
      await loadRemovedApps();
    } finally {
      setRestoreBusy(false);
    }
  }, [loadRemovedApps]);

  const openRestoreDialog = useCallback(() => {
    void loadRemovedApps();
    setRestoreOpen(true);
  }, [loadRemovedApps]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">{emulatorName}</h2>
          <p className="text-xs text-muted-foreground">{instance.displayName || instance.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={carregando}
          className="gap-1.5"
        >
          <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar apps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter + Presets + Select All */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'system', 'user', 'disabled'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === 'all'
                ? `Todos (${filterCounts.all})`
                : f === 'system'
                  ? `Sistema (${filterCounts.system})`
                  : f === 'user'
                    ? `Usuário (${filterCounts.user})`
                    : `Desabilitados (${filterCounts.disabled})`}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <div className="relative" ref={presetsRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetsOpen(!presetsOpen)}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="size-3.5" />
              Presets
              <ChevronDown
                className={cn('size-3 transition-transform', presetsOpen && 'rotate-180')}
              />
            </Button>
            {presetsOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[200px]">
                <button
                  type="button"
                  onClick={handleSelectBloatware}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <div>
                    <p className="font-medium">Selecionar Bloatware</p>
                    <p className="text-muted-foreground text-[10px]">Todos os apps conhecidos</p>
                  </div>
                </button>
                <div className="h-px bg-border my-1" />
                {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                  const preset = PRESETS[key];
                  const presetPkgs = preset.packages as readonly string[];
                  const matchingCount = listaApps.filter((a) =>
                    presetPkgs.includes(a.packageName)
                  ).length;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => handlePreset(key)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Bookmark className="size-3.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-muted-foreground text-[10px]">{preset.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {matchingCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openRestoreDialog}
            className="gap-1.5 text-xs"
          >
            <History className="size-3.5" />
            Restaurar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs">
            {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </Button>
        </div>
      </div>

      {/* App List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {carregando ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mb-2" />
            <p className="text-sm">Carregando apps...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">
              {listaApps.length === 0
                ? 'Nenhum app encontrado no dispositivo'
                : 'Nenhum app corresponde ao filtro'}
            </p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <Card
              key={app.packageName}
              className={cn(
                'transition-all duration-150 cursor-pointer',
                appsSelecionados.has(app.packageName) && 'border-primary/50 bg-primary/5'
              )}
              onClick={() => toggleAppSelection(app.packageName)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={appsSelecionados.has(app.packageName)}
                    onChange={() => toggleAppSelection(app.packageName)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-4 rounded border-muted-foreground accent-primary mt-0.5 shrink-0"
                  />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="size-8 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      {(() => {
                        const IconComp = APP_ICON_MAP[app.packageName];
                        if (IconComp) return <IconComp size={20} />;
                        return (
                          <span className="text-xs font-bold text-muted-foreground">
                            {app.label.charAt(0).toUpperCase()}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold truncate" title={app.label}>
                          {app.label}
                        </p>
                        {app.isSystem && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                            SIST
                          </Badge>
                        )}
                        {app.isDisabled && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 shrink-0 bg-orange-500/15 text-orange-400 border-orange-500/30"
                          >
                            DESAB
                          </Badge>
                        )}
                      </div>
                      <p
                        className="text-[10px] text-muted-foreground truncate mt-0.5"
                        title={app.packageName}
                      >
                        {app.packageName}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Removal Progress */}
      {removalProgress && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Processando {removalProgress.current} de {removalProgress.total}...
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round((removalProgress.current / removalProgress.total) * 100)}%
            </span>
          </div>
          <Progress
            value={(removalProgress.current / removalProgress.total) * 100}
            className="h-1.5"
          />
        </div>
      )}

      {/* Selection Bar */}
      {appsSelecionados.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {appsSelecionados.size} selecionado{appsSelecionados.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={removing}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar remoção</DialogTitle>
            <DialogDescription>
              Remover {appsSelecionados.size} app{appsSelecionados.size !== 1 ? 's' : ''}?
              {appsSelecionados.size > 0 && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  {Array.from(appsSelecionados).slice(0, 5).join(', ')}
                  {appsSelecionados.size > 5 && ` e mais ${appsSelecionados.size - 5}...`}
                </span>
              )}
              {selHasSystem && (
                <span className="block mt-2 text-xs text-amber-400">
                  A seleção inclui apps de sistema/críticos — eles receberão backup automático antes
                  da remoção. Apps protegidos que não puderem ser desinstalados serão desabilitados.
                  Removê-los pode deixar o emulador instável.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Restaurar apps removidos</DialogTitle>
            <DialogDescription>
              Apps removidos podem ser reinstalados na instância atual. Apps desabilitados
              (protegidos) são reativados via ADB.
            </DialogDescription>
          </DialogHeader>
          {restoreBusy && <p className="text-xs text-muted-foreground">Processando...</p>}
          {restoreError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              {restoreError}
            </div>
          )}
          {removedApps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum app removido.</p>
          ) : (
            <div className="space-y-4">
              {renderRemovedSection(
                'Instância atual',
                removedApps.filter((r) => r.instanceId === instance.id)
              )}
              {renderRemovedSection(
                'Outras instâncias',
                removedApps.filter((r) => r.instanceId !== instance.id)
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearHistory()}
              disabled={restoreBusy || removedApps.length === 0}
            >
              Limpar histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderRemovedSection(title: string, items: RemovedApp[]) {
    if (items.length === 0) return null;
    const isCurrent = items[0].instanceId === instance.id;
    return (
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          {title} ({items.length})
        </p>
        <div className={cn('space-y-1.5', !isCurrent && 'opacity-55')}>
          {items.map((app) => (
            <div
              key={app.packageName}
              className="flex items-center gap-2 rounded-lg border border-border p-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{app.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{app.packageName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(app.removedAt).toLocaleString('pt-BR')} · {app.instanceName}
                </p>
              </div>
              {app.mode === 'disabled' ? (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 shrink-0 bg-orange-500/15 text-orange-400 border-orange-500/30"
                >
                  Desabilitado
                </Badge>
              ) : app.hasBackup ? (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                  Com backup
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 shrink-0 bg-orange-500/15 text-orange-400 border-orange-500/30"
                >
                  Sem backup
                </Badge>
              )}
              {isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={restoreBusy || (!app.hasBackup && app.mode !== 'disabled')}
                  onClick={() => handleRestoreRemoved(app)}
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                disabled={restoreBusy}
                title="Remover do histórico"
                onClick={() => handleClearRemoved(app)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
