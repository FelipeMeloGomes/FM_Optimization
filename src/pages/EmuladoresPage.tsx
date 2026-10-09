import { AlertCircle, FolderCog, Gamepad2, Loader2, MonitorSmartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import bluestacksLogo from '../assets/bluestacks-logo.png';
import { showEnhancedToast } from '../components/EnhancedToast';
import { Badge, Button, Card, CardContent, Switch } from '../components/ui';
import { EmulatorProvider, useEmulatorContext } from '../contexts/EmulatorContext';
import { useSettingsContext } from '../contexts/SettingsContext';
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
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
  },
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
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

  useEffect(() => {
    window.electronAPI
      .adbGetPath()
      .then(setAdbPath)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Detectar versão dos emuladores na montagem (paralelo)
    const detectAllVersions = async () => {
      try {
        const results = await Promise.all(
          EMULATORS.map((emulator) => window.electronAPI.adbDetectEmulator(emulator.id))
        );
        const newVersions: Record<string, string> = {};
        for (let i = 0; i < EMULATORS.length; i++) {
          const result = results[i];
          if (result.installed && result.version) {
            newVersions[EMULATORS[i].id] = result.version;
          }
        }
        setDetectedVersions(newVersions);
      } catch (e: unknown) {
        console.error('[EmuladoresPage] Error detecting versions', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    };
    detectAllVersions();
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
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Gamepad2 className="size-28 text-primary" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Emuladores
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Debloat de Apps Android</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Conecte-se a emuladores Android via ADB para remover apps indesejados
          </p>
        </div>
      </div>

      {/* ADB Status */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <MonitorSmartphone className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Caminho ADB</p>
              <p className="text-sm font-medium font-mono truncate">{adbPath || 'Detectando...'}</p>
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
                'transition-all duration-200',
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
                      <p className="text-xs text-muted-foreground mt-0.5">{emulator.description}</p>
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
                      {connecting && !isActive ? 'Conectando...' : 'ADB'}
                    </span>
                  </div>
                  {isActive ? (
                    <Badge variant="default" className={cn('text-[10px]', colors.text)}>
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
          Conectando ao ADB...
        </div>
      )}

      <InstanceSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        instances={instances}
        loading={instancesLoading}
        onSelect={handleInstanceSelect}
      />
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
