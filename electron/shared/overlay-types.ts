/** Canto da tela onde o pill de FPS fica ancorado. */
export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Um jogo cadastrado pelo usuário apontando o executável. */
export interface OverlayGame {
  id: string;
  name: string;
  exePath: string;
  processName: string;
  /** Nome do arquivo em `covers/`, ou null quando não há capa. */
  coverFile: string | null;
  enabled: boolean;
}

/** Modo de tela de um jogo cadastrado, quando o app conhece sua configuração. */
export type GameDisplayMode = 'windowed' | 'borderless' | 'exclusive' | 'unknown';

export interface GameDisplayModeInfo {
  /** `unknown` quando o jogo não é conhecido ou o arquivo não foi encontrado. */
  mode: GameDisplayMode;
}

/** Configuração global do overlay (uma única engrenagem na página). */
export interface OverlaySettings {
  hotkey: string;
  position: OverlayPosition;
  opacity: number;
  targetFps: number;
  onlyWhenFocused: boolean;
}

export type OverlayCaptureState = 'idle' | 'waiting' | 'capturing' | 'error';

/** Estado agregado publicado pelo manager para a página. */
export interface OverlayStatus {
  capture: OverlayCaptureState;
  activeGameId: string | null;
  /** IDs dos jogos cadastrados que estão rodando. */
  runningGameIds: string[];
  /** Mensagem de erro em português, quando houver (ex.: falta de privilégio). */
  message: string | null;
  /** Aviso não-fatal, como atalho global já ocupado por outro app. */
  warning?: string | null;
}

/** Um frame publicado para a janela do overlay. */
export interface OverlayFrame {
  fps: number;
  color: 'good' | 'bad';
  visible: boolean;
}

/** API exposta apenas na janela transparente do overlay. */
export interface OverlayApi {
  onFrame(cb: (frame: OverlayFrame) => void): () => void;
  onSettings(cb: (settings: OverlaySettings) => void): () => void;
}

export interface AddOverlayGameInput {
  exePath: string;
}

export interface SetOverlayGameEnabledInput {
  id: string;
  enabled: boolean;
}

const HOTKEY_MODIFIERS = new Set([
  'CMD',
  'COMMAND',
  'CTRL',
  'CONTROL',
  'ALT',
  'SHIFT',
  'SUPER',
  'META',
  'OPTION',
  'FN',
  'CMDORCTRL',
  'COMMANDORCONTROL',
]);

const HOTKEY_KEYS = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `Numpad${i}`),
  ...Array.from({ length: 10 }, (_, i) => `Num${i}`),
  'ESCAPE',
  'ESC',
  'TAB',
  'SPACE',
  'PLUS',
  'MINUS',
  'BACKSPACE',
  'DELETE',
  'DEL',
  'INSERT',
  'HOME',
  'END',
  'PAGEUP',
  'PAGEDOWN',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'ENTER',
  'RETURN',
  'NUMLOCK',
  'CAPSLOCK',
  'SCROLLLOCK',
  'PAUSE',
  'PRINTSCREEN',
  'SNAPSHOT',
  'HELP',
  'CONTEXTMENU',
  'MULTIPLY',
  'ADD',
  'SUBTRACT',
  'DECIMAL',
  'DIVIDE',
]);

/**
 * Só aceita aceleradores que o Electron converte. O Event do teclado pode
 * produzir "AltGraph" (AltGr) ou "Dead", que fazem globalShortcut.register
 * lançar uma TypeError e abortar a captura do overlay.
 */
export function isValidOverlayHotkey(value: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split('+').map((part) => part.trim().toUpperCase());
  if (parts.length < 1 || parts.length > 5 || parts.some((part) => !part)) return false;
  if (!parts.every((part) => HOTKEY_MODIFIERS.has(part) || HOTKEY_KEYS.has(part))) return false;
  return parts.some((part) => !HOTKEY_MODIFIERS.has(part));
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  hotkey: 'Ctrl+Shift+F',
  position: 'top-left',
  opacity: 0.85,
  targetFps: 60,
  onlyWhenFocused: true,
};
