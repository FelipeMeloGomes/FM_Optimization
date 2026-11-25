import { AlertCircle, FolderCog, Loader2, MonitorSmartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import bluestacksLogo from '../assets/bluestacks-logo.png';
import { showEnhancedToast } from '../components/EnhancedToast';
import { HeroBanner, HeroDescription } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageSkeleton } from '../components/PageSkeleton';
import { Badge, Button, Card, CardContent, Switch } from '../components/ui';
import { EmulatorProvider, useEmulatorContext } from '../contexts/EmulatorContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { HERO_ART } from '../lib/hero-art';
import { cn } from '../lib/utils';
import type { EmulatorInstance } from '../types/emulator';
import { AppListView } from './EmuladoresPage/AppListView';
import { InstanceSelectionModal } from './EmuladoresPage/InstanceSelectionModal';

interface EmulatorCard {
  id: 'bluestacks-4' | 'bluestacks-5';
  name: string;
  description: string;
  color: string;
  version: string;
}

const EMULATORS: EmulatorCard[] = [
  {
    id: 'bluestacks-4',
    name: 'BlueStacks 4',
    description: 'Emulador Android Nougat (64-bit)',
    color: 'blue',
    version: '4',
  },
  {
    id: 'bluestacks-5',
    name: 'BlueStacks 5',
    description: 'Emulador Android Pie (64-bit)',
    color: 'emerald',
    version: '5',
  },
];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; shadow: string }> = {
  blue: {
    border: 'border-info/30',
    bg: 'bg-info/10',
    text: 'text-info',
    shadow: 'shadow-[0_0_15px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]',
  },
  emerald: {
    border: 'border-success/30',
    bg: 'bg-success/10',
    text: 'text-success',
    shadow: 'shadow-[0_0_15px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]',
  },
};

function EmuladoresPageContent() {
  const {
    emulatorAtivo,
    instanciaSelecionada,
    deviceSerial,
    setEmulatorAtivo,
    setInstanciaSelecionada,
    setDeviceSerial,
    setListaApps,
    setCarregando,
  } = useEmulatorContext();

  const { settings, update } = useSettingsContext();

  const [currentView, setCurrentView] = useState<'select-emulator' | 'app-list'>('select-emulator');
  const [selectedInstance, setSelectedInstance] = useState<EmulatorInstance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmulator, setSelectedEmulator] = useState<EmulatorCard | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [adbPath, setAdbPath] = useState('');
  const [adbError, setAdbError] = useState<string | null>(null);
  const [choosingAdb, setChoosingAdb] = useState(false);
  const [instances, setInstances] = useState<EmulatorInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [detectedVersions, setDetectedVersions] = useState<Record<string, string>>({});
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    // Caminho do ADB e versões dos emuladores são lidos na montagem, em paralelo.
    let mounted = true;
    const detect = async () => {
      try {
        const [adbPathResult, results] = await Promise.all([
          window.electronAPI.adbGetPath(),
          Promise.all(
            EMULATORS.map((emulator) => window.electronAPI.adbDetectEmulator(emulator.id))
          ),
        ]);
        if (!mounted) return;
        setAdbPath(adbPathResult);
        const newVersions: Record<string, string> = {};
        for (let i = 0; i < EMULATORS.length; i++) {
          const result = results[i];
          if (result.installed && result.version) {
            newVersions[EMULATORS[i].id] = result.version;
          }
        }
        setDetectedVersions(newVersions);
      } catch (e: unknown) {
        console.error('[EmuladoresPage] Error detecting ADB', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (mounted) setDetecting(false);
      }
    };
    void detect();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = useCallback(
    async (emulator: EmulatorCard) => {
      if (emulatorAtivo === emulator.id) {
        setEmulatorAtivo(null);
        setInstanciaSelecionada(null);
        setDeviceSerial(null);
        setCurrentView('select-emulator');
        setAdbError(null);
        return;
      }

      setConnecting(true);
      setAdbError(null);
      try {
        const detection = await window.electronAPI.adbDetectEmulator(emulator.id);
        if (!detection.installed) {
          setAdbError(`${emulator.name} não está instalado neste sistema.`);
          return;
        }

        await window.electronAPI.adbSetPath(detection.adbPath);
        const devices = await window.electronAPI.adbListDevices();
        if (devices.length === 0) {
          setAdbError('Nenhum dispositivo encontrado. Inicie o emulador primeiro.');
          return;
        }
        const connected = devices.filter((d) => d.state === 'device');
        if (connected.length === 0) {
          setAdbError(
            `Dispositivo(s) encontrado(s) mas offline: ${devices.map((d) => d.serial).join(', ')}`
          );
          return;
        }
        setEmulatorAtivo(emulator.id);
        setDeviceSerial(connected[0].serial);
      } catch (e: unknown) {
        const msg = typeof e === 'string' ? e : (e as Error).message;
        setAdbError(`Erro ao conectar ADB: ${msg}`);
      } finally {
        setConnecting(false);
      }
    },
    [emulatorAtivo, setEmulatorAtivo, setInstanciaSelecionada, setDeviceSerial]
  );

  const handleCardClick = useCallback(
    async (emulator: EmulatorCard) => {
      if (emulatorAtivo !== emulator.id) return;
      setSelectedEmulator(emulator);
      setInstancesLoading(true);
      setModalOpen(true);
      try {
        const result = await window.electronAPI.adbListInstances(emulator.id);
        setInstances(result);
      } catch {
        setInstances([]);
      } finally {
        setInstancesLoading(false);
      }
    },
    [emulatorAtivo]
  );

  const handleInstanceSelect = useCallback(
    async (instance: { id: string; name: string; arch: string }) => {
      if (!selectedEmulator || !deviceSerial) return;
      setInstanciaSelecionada(instance.id);
      setSelectedInstance(instance);
      setCarregando(true);
      setCurrentView('app-list');
      try {
        const apps = await window.electronAPI.adbListApps(deviceSerial);
        setListaApps(apps);
      } catch {
        setListaApps([]);
      } finally {
        setCarregando(false);
      }
    },
    [selectedEmulator, deviceSerial, setInstanciaSelecionada, setListaApps, setCarregando]
  );

  const handleChooseAdbFolder = useCallback(async () => {
    setChoosingAdb(true);
    setAdbError(null);
    try {
      const result = await window.electronAPI.adbChoosePath();
      if (result.canceled || !result.adbPath) return;
      setAdbPath(result.adbPath);
      update({ adbPath: result.adbPath });
      showEnhancedToast({
        type: 'success',
        title: 'Caminho ADB atualizado',
        description: result.adbPath,
        duration: settings.toastDuration,
        sound: settings.soundEnabled,
      });
    } catch (e: unknown) {
      const msg = typeof e === 'string' ? e : (e as Error).message;
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível alterar o ADB',
        description: msg,
        duration: settings.toastDuration,
        sound: settings.soundEnabled,
      });
    } finally {
      setChoosingAdb(false);
    }
  }, [update, settings.toastDuration, settings.soundEnabled]);

  if (currentView === 'app-list' && emulatorAtivo) {
    const emulator = EMULATORS.find((e) => e.id === emulatorAtivo);
    const fallbackInstance: EmulatorInstance = {
      id: instanciaSelecionada || '',
      name: instanciaSelecionada || '',
      arch: '',
    };
    return (
      <AppListView
        emulatorName={emulator?.name || ''}
        instance={selectedInstance ?? fallbackInstance}
        deviceSerial={deviceSerial || ''}
        onBack={() => {
          setCurrentView('select-emulator');
          setInstanciaSelecionada(null);
          setSelectedInstance(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner {...HERO_ART['/emuladores']}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <RouteIcon path="/emuladores" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Emuladores
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Debloat de Apps Android</h2>
          <HeroDescription text="Conecte-se a emuladores Android via ADB para remover apps indesejados" />
        </div>
      </HeroBanner>

      {detecting ? (
        <PageSkeleton
          layout="emulators"
          count={EMULATORS.length}
          hero="none"
          label="Detectando ADB…"
        />
      ) : (
        <>
          {/* ADB Status */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <MonitorSmartphone className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Caminho ADB</p>
                  <p className="text-sm font-medium font-mono truncate">
                    {adbPath || 'Detectando…'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleChooseAdbFolder}
                  disabled={choosingAdb}
                  title="Alterar pasta do ADB"
                  aria-label="Alterar pasta do ADB"
                >
                  {choosingAdb ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FolderCog className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error Banner */}
          {adbError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              {adbError}
            </div>
          )}

          {/* Emulator Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EMULATORS.map((emulator) => {
              const isActive = emulatorAtivo === emulator.id;
              const colors = COLOR_MAP[emulator.color];

              return (
                <Card
                  key={emulator.id}
                  className={cn(
                    'transition-[color,background-color,border-color,box-shadow,opacity] duration-200',
                    isActive && [colors.border, colors.shadow],
                    isActive && 'cursor-pointer'
                  )}
                  onClick={() => handleCardClick(emulator)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div
                            className={cn(
                              'flex size-11 items-center justify-center rounded-xl overflow-hidden transition-colors',
                              isActive ? colors.bg : 'bg-muted'
                            )}
                          >
                            <img
                              src={bluestacksLogo}
                              alt={`BlueStacks ${emulator.version}`}
                              className="size-8 object-contain"
                            />
                          </div>
                          <span
                            className={cn(
                              'absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold',
                              isActive
                                ? `${colors.bg} ${colors.text} ring-1 ring-current/20`
                                : 'bg-muted text-muted-foreground ring-1 ring-border'
                            )}
                          >
                            {emulator.version}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold">
                            {emulator.name}
                            {detectedVersions[emulator.id] && (
                              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                v{detectedVersions[emulator.id]}
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {emulator.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggle(emulator)}
                          disabled={connecting}
                        />
                        <span className="text-xs text-muted-foreground">
                          {connecting && !isActive ? 'Conectando…' : 'ADB'}
                        </span>
                      </div>
                      {isActive ? (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Desconectado
                        </Badge>
                      )}
                    </div>

                    {isActive && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                          <MonitorSmartphone className="size-3.5" />
                          Selecionar Instância
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Loading overlay */}
          {connecting && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Conectando ao ADB…
            </div>
          )}

          <InstanceSelectionModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            instances={instances}
            loading={instancesLoading}
            onSelect={handleInstanceSelect}
          />
        </>
      )}
    </div>
  );
}

export default function EmuladoresPage() {
  return (
    <EmulatorProvider>
      <EmuladoresPageContent />
    </EmulatorProvider>
  );
}
