import { join, resolve } from 'node:path';
import { BrowserWindow, globalShortcut, screen } from 'electron';
import type { OverlayFrame, OverlayPosition, OverlaySettings } from '../shared/overlay-types';

const MARGIN = 24;
const WIDTH = 140;
const HEIGHT = 44;

let overlayWindow: BrowserWindow | null = null;
let currentHotkey: string | null = null;

interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeOverlayRect(
  position: OverlayPosition,
  workArea: WorkArea
): { x: number; y: number; width: number; height: number } {
  const x = position.endsWith('right')
    ? workArea.x + workArea.width - MARGIN - WIDTH
    : workArea.x + MARGIN;
  const y = position.startsWith('bottom')
    ? workArea.y + workArea.height - MARGIN - HEIGHT
    : workArea.y + MARGIN;
  return { x, y, width: WIDTH, height: HEIGHT };
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

/** Cria a janela transparente, sob demanda. Nunca captura clique do jogador. */
export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;

  const rect = computeOverlayRect('top-left', screen.getPrimaryDisplay().workArea);
  const win = new BrowserWindow({
    ...rect,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setFocusable(false);

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void win.loadURL(`${rendererUrl}/overlay.html`);
  } else {
    void win.loadFile(resolve(__dirname, '../renderer/overlay.html'));
  }

  overlayWindow = win;
  return win;
}

export function showOverlayWindow(): void {
  getOverlayWindow()?.show();
}

export function hideOverlayWindow(): void {
  getOverlayWindow()?.hide();
}

export function toggleOverlayWindow(): void {
  const win = getOverlayWindow();
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.show();
}

export function updateOverlayFrame(frame: OverlayFrame): void {
  getOverlayWindow()?.webContents.send('overlay:frame', frame);
}

/** Aplica posição/opacidade e registra (ou troca) o atalho global. */
export function applyOverlaySettings(settings: OverlaySettings): boolean {
  const win = getOverlayWindow();
  if (win) {
    win.setOpacity(settings.opacity);
    win.setBounds(computeOverlayRect(settings.position, screen.getPrimaryDisplay().workArea));
    win.webContents.send('overlay:settings', settings);
  }
  return registerToggleShortcut(settings.hotkey, toggleOverlayWindow);
}

export function registerToggleShortcut(hotkey: string, cb: () => void): boolean {
  if (currentHotkey && currentHotkey !== hotkey) globalShortcut.unregister(currentHotkey);
  try {
    const registered = globalShortcut.register(hotkey, cb);
    if (registered) currentHotkey = hotkey;
    return registered;
  } catch {
    // O Electron lança TypeError (não retorna false) para aceleradores
    // inválidos como "AltGraph". Nunca deixa isso abortar o tick do overlay.
    return false;
  }
}

export function destroyOverlayWindow(): void {
  overlayWindow?.destroy();
  overlayWindow = null;
  globalShortcut.unregisterAll();
  currentHotkey = null;
}
