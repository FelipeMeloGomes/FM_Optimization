import {
  AlertTriangle,
  Gamepad2,
  Monitor,
  Play,
  Plus,
  Settings2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../electron/shared/errors';
import type {
  GameDisplayModeInfo,
  OverlayGame,
  OverlayPosition,
  OverlaySettings,
  OverlayStatus,
} from '../../electron/shared/overlay-types';
import {
  DEFAULT_OVERLAY_SETTINGS,
  isValidOverlayHotkey,
} from '../../electron/shared/overlay-types';
import { HeroBanner } from '../components/hero/HeroBanner';
import { HeroBannerContent } from '../components/hero/HeroBannerContent';
import { PageSkeleton } from '../components/PageSkeleton';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '../components/ui';
import { HERO_ART } from '../lib/hero-art';
import { cn } from '../lib/utils';

const POSITIONS: Array<{ value: OverlayPosition; label: string }> = [
  { value: 'top-left', label: 'Superior esquerdo' },
  { value: 'top-right', label: 'Superior direito' },
  { value: 'bottom-left', label: 'Inferior esquerdo' },
  { value: 'bottom-right', label: 'Inferior direito' },
];

const PREVIEW_POSITION_CLASSES: Record<OverlayPosition, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

const PREVIEW_FPS = 142;

function initials(name: string): string {
  const words = name.split(/[^\p{L}]+/u).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

const KEY_ALIASES: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ' ': 'Space',
};

/** Devolve null para teclas que o Electron não aceita como acelerador. */
function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const raw = event.key;
  const key = KEY_ALIASES[raw] ?? (raw.length === 1 ? raw.toUpperCase() : raw);
  parts.push(key);
  const hotkey = parts.join('+');
  return isValidOverlayHotkey(hotkey) ? hotkey : null;
}

/** Capas ficam em disco; o main process devolve um data URL sem abrir HTTP. */
function useCover(coverFile: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    const read = window.electronAPI.getOverlayCover;
    if (!coverFile || typeof read !== 'function') return;
    let cancelled = false;
    void Promise.resolve(read(coverFile)).then(
      (data) => {
        if (!cancelled) setUrl(data);
      },
      () => {
        if (!cancelled) setUrl(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [coverFile]);

  return url;
}

function GameCard({
  game,
  status,
  onLaunch,
  onToggle,
  onRemove,
}: {
  game: OverlayGame;
  status: OverlayStatus;
  onLaunch(): void;
  onToggle(enabled: boolean): void;
  onRemove(): void;
}) {
  const cover = useCover(game.coverFile);
  const running = status.runningGameIds.includes(game.id);
  const capturing = running && status.activeGameId === game.id;

  return (
    <Card className={cn('transition-colors', capturing && 'border-primary/40 bg-primary/5')}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
          {cover ? (
            <img src={cover} alt={`Capa de ${game.name}`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
              {initials(game.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{game.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{game.processName}</p>
          {running ? (
            <Badge
              variant="secondary"
              className="mt-2 border-success/30 bg-success/10 text-success"
            >
              {capturing ? 'rodando · capturando' : 'rodando'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="mt-2">
              não está rodando
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onLaunch}
            aria-label={`Iniciar ${game.name}`}
            title={`Iniciar ${game.name}`}
          >
            <Play className="size-4 text-primary" />
          </Button>
          <Switch
            checked={game.enabled}
            onCheckedChange={onToggle}
            aria-label={`Habilitar overlay para ${game.name}`}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remover ${game.name}`}
            title={`Remover ${game.name}`}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Aviso por jogo quando o modo de tela impede o pill de aparecer dentro do jogo. */
function GameDisplayModeNotice({
  game,
  info,
  onApply,
}: {
  game: OverlayGame;
  info: GameDisplayModeInfo | undefined;
  onApply(): void;
}) {
  const [applied, setApplied] = useState(false);
  const mode = applied ? 'borderless' : (info?.mode ?? 'unknown');

  if (mode === 'unknown' || mode === 'windowed') return null;

  if (mode === 'exclusive') {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
        <p className="flex items-center gap-1.5 font-semibold text-warning">
          <Monitor className="size-3.5 shrink-0" />
          {game.name} está em tela cheia exclusiva
        </p>
        <p className="mt-1 text-muted-foreground">
          O pill de FPS não aparece dentro do jogo nesse modo. Troque para borderless para manter a
          tela cheia e ver o FPS.
        </p>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            onApply();
            setApplied(true);
          }}
        >
          Usar borderless
        </Button>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-success">
      <Monitor className="size-3.5 shrink-0" />
      {applied ? 'Reinicie o jogo para ver o FPS.' : 'borderless · overlay pronto'}
    </p>
  );
}

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: OverlaySettings;
  onSave(next: OverlaySettings): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState<OverlaySettings>(settings);
  const [recording, setRecording] = useState(false);
  const [hotkeyError, setHotkeyError] = useState(false);
  const previewIsGood = PREVIEW_FPS >= draft.targetFps;

  useEffect(() => setDraft(settings), [settings]);

  useEffect(() => {
    if (!recording) return;
    const capture = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
      event.preventDefault();
      const hotkey = acceleratorFromEvent(event);
      if (!hotkey) return; // AltGraph/Dead/etc. não são aceleradores válidos.
      setDraft((current) => ({ ...current, hotkey }));
      setHotkeyError(false);
      setRecording(false);
    };
    window.addEventListener('keydown', capture);
    return () => window.removeEventListener('keydown', capture);
  }, [recording]);

  return (
    <Card className="border-border/80 bg-card/60">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Configurações do overlay</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar configurações">
          <span aria-hidden="true">✕</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="overlay-atalho">Atalho</Label>
          <div className="flex gap-2">
            <Input
              id="overlay-atalho"
              value={draft.hotkey}
              onChange={(event) => {
                setDraft({ ...draft, hotkey: event.target.value });
                setHotkeyError(false);
              }}
            />
            <Button
              type="button"
              variant={recording ? 'default' : 'outline'}
              onClick={() => setRecording((value) => !value)}
            >
              {recording ? 'Pressione a tecla…' : 'Gravar'}
            </Button>
          </div>
          {hotkeyError ? (
            <p className="text-xs text-destructive" role="alert">
              Atalho inválido. Use uma tecla ou combinação como Ctrl+Shift+F.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mostra ou esconde o pill dentro do jogo. ↑
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="overlay-posicao">Posição</Label>
          <select
            id="overlay-posicao"
            value={draft.position}
            onChange={(event) =>
              setDraft({ ...draft, position: event.target.value as OverlayPosition })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {POSITIONS.map((position) => (
              <option key={position.value} value={position.value}>
                {position.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="overlay-opacidade">Opacidade</Label>
            <span className="text-xs font-medium text-primary">
              {Math.round(draft.opacity * 100)}%
            </span>
          </div>
          <input
            id="overlay-opacidade"
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={draft.opacity}
            onChange={(event) => setDraft({ ...draft, opacity: Number(event.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="overlay-fps-alvo">FPS alvo</Label>
          <Input
            id="overlay-fps-alvo"
            type="number"
            min={30}
            max={360}
            value={draft.targetFps}
            onChange={(event) => setDraft({ ...draft, targetFps: Number(event.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            Acima do alvo o número fica verde; abaixo, vermelho.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="overlay-foco" className="cursor-pointer">
            Mostrar somente quando o jogo estiver em foco
          </Label>
          <Switch
            id="overlay-foco"
            checked={draft.onlyWhenFocused}
            onCheckedChange={(checked) => setDraft({ ...draft, onlyWhenFocused: checked })}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Prévia
          </p>
          <div className="relative h-24 overflow-hidden rounded-lg bg-gradient-to-br from-muted/60 via-card to-primary/20">
            <div
              className={cn(
                'absolute inline-flex items-baseline gap-1 rounded-md bg-background/80 px-2 py-1 font-mono',
                PREVIEW_POSITION_CLASSES[draft.position]
              )}
              style={{ opacity: draft.opacity }}
            >
              <span
                className={cn(
                  'text-lg font-extrabold',
                  previewIsGood ? 'text-success' : 'text-destructive'
                )}
              >
                {PREVIEW_FPS}
              </span>
              <span
                className={cn(
                  'text-[9px] font-bold tracking-widest',
                  previewIsGood ? 'text-success' : 'text-destructive'
                )}
              >
                FPS
              </span>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => {
            if (!isValidOverlayHotkey(draft.hotkey)) {
              setHotkeyError(true);
              return;
            }
            onSave(draft);
          }}
        >
          Salvar configurações
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusLine({ status }: { status: OverlayStatus }) {
  if (status.capture === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <ShieldAlert className="size-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-destructive-foreground">{status.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void window.electronAPI.restartOverlayElevated()}
        >
          Reiniciar como administrador
        </Button>
      </div>
    );
  }

  if (status.warning) {
    return (
      <div
        className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
        role="status"
      >
        {status.warning}
      </div>
    );
  }

  const label =
    status.capture === 'capturing'
      ? '● Capturando FPS do jogo em foco'
      : status.capture === 'waiting'
        ? '● Jogo aberto · aguardando captura'
        : '● Capturador pronto · aguardando jogo';

  return (
    <p className="font-mono text-xs font-semibold text-success" role="status">
      {label}
    </p>
  );
}

export default function OverlayJogoPage() {
  const [games, setGames] = useState<OverlayGame[]>([]);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [status, setStatus] = useState<OverlayStatus>({
    capture: 'idle',
    activeGameId: null,
    runningGameIds: [],
    message: null,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayModes, setDisplayModes] = useState<Record<string, GameDisplayModeInfo>>({});

  const load = useCallback(async () => {
    try {
      const [loadedGames, loadedSettings, loadedStatus] = await Promise.all([
        window.electronAPI.getOverlayGames(),
        window.electronAPI.getOverlaySettings(),
        window.electronAPI.getOverlayStatus(),
      ]);
      setGames(loadedGames);
      setSettings(loadedSettings);
      setStatus(loadedStatus);
      const modes = await Promise.all(
        loadedGames.map(async (game) => ({
          id: game.id,
          info: await window.electronAPI.getGameDisplayMode(game.id),
        }))
      );
      setDisplayModes(Object.fromEntries(modes.map((entry) => [entry.id, entry.info])));
      setError(null);
    } catch (cause) {
      setError(toErrorMessage(cause) || 'Não foi possível carregar o overlay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return window.electronAPI.onOverlayStatus(setStatus);
  }, [load]);

  const addGame = async (): Promise<void> => {
    try {
      const chosen = await window.electronAPI.chooseOverlayExe();
      if (!chosen) return;
      const created = await window.electronAPI.addOverlayGame(chosen);
      setGames((current) => [...current, created]);
    } catch (cause) {
      setError(toErrorMessage(cause) || 'Não foi possível adicionar o jogo.');
    }
  };

  const toggleGame = async (game: OverlayGame, enabled: boolean): Promise<void> => {
    setGames((current) =>
      current.map((item) => (item.id === game.id ? { ...item, enabled } : item))
    );
    try {
      await window.electronAPI.setOverlayGameEnabled({ id: game.id, enabled });
    } catch {
      setGames((current) =>
        current.map((item) => (item.id === game.id ? { ...item, enabled: game.enabled } : item))
      );
      setError('Não foi possível alterar este jogo.');
    }
  };

  const removeGame = async (game: OverlayGame): Promise<void> => {
    setGames((current) => current.filter((item) => item.id !== game.id));
    try {
      await window.electronAPI.removeOverlayGame(game.id);
    } catch {
      setGames((current) => [...current, game]);
      setError('Não foi possível remover este jogo.');
    }
  };

  const saveSettings = async (next: OverlaySettings): Promise<void> => {
    try {
      await window.electronAPI.saveOverlaySettings(next);
      setSettings(next);
      setShowSettings(false);
      setError(null);
    } catch (cause) {
      setError(toErrorMessage(cause) || 'Não foi possível salvar as configurações.');
    }
  };

  const launchGame = async (game: OverlayGame): Promise<void> => {
    try {
      await window.electronAPI.launchOverlayGame(game.id);
      setError(null);
    } catch (cause) {
      setError(toErrorMessage(cause) || 'Não foi possível iniciar o jogo.');
    }
  };

  const applyBorderless = async (game: OverlayGame): Promise<void> => {
    try {
      const result = await window.electronAPI.setGameBorderless(game.id);
      setDisplayModes((current) => ({ ...current, [game.id]: result }));
      setError(null);
    } catch (cause) {
      setError(toErrorMessage(cause) || 'Não foi possível ajustar o modo de tela.');
    }
  };

  return (
    <div className="space-y-6">
      <HeroBanner {...HERO_ART['/overlay-jogo']}>
        <HeroBannerContent
          badge="Ferramentas"
          path="/overlay-jogo"
          title="Overlay de jogo"
          description="Cadastre seus jogos. O overlay sobe sozinho quando um deles abre em borderless."
          size="lg"
          descriptionClassName="max-w-2xl"
          titleTrailing={
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Configurações do overlay"
              title="Configurações do overlay"
              onClick={() => setShowSettings((value) => !value)}
            >
              <Settings2 className="size-4" />
            </Button>
          }
        />
      </HeroBanner>

      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4 shrink-0" />
          Tela cheia exclusiva não é suportada
        </div>
        <p className="mt-1 text-muted-foreground">
          Use o modo borderless (janela sem bordas em tela cheia) para ver o FPS dentro do jogo.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <StatusLine status={status} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-foreground">Jogos cadastrados</h3>
            <Button size="sm" onClick={() => void addGame()} className="gap-1.5">
              <Plus className="size-4" />
              Adicionar jogo
            </Button>
          </div>

          {loading && <PageSkeleton layout="overlay" label="Carregando jogos…" />}

          {!loading && games.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Gamepad2 className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum jogo cadastrado</p>
                <p className="text-xs text-muted-foreground">
                  Escolha o executável do jogo para começar.
                </p>
              </CardContent>
            </Card>
          )}

          {games.map((game) => (
            <div key={game.id} className="space-y-2">
              <GameCard
                game={game}
                status={status}
                onLaunch={() => void launchGame(game)}
                onToggle={(enabled) => void toggleGame(game, enabled)}
                onRemove={() => void removeGame(game)}
              />
              <GameDisplayModeNotice
                game={game}
                info={displayModes[game.id]}
                onApply={() => void applyBorderless(game)}
              />
            </div>
          ))}
        </div>

        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSave={(next) => void saveSettings(next)}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}
