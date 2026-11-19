import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayFrame, OverlayPosition, OverlaySettings } from '../../shared/overlay-types';

const mocks = vi.hoisted(() => ({
  windows: [] as unknown[],
  shortcuts: new Map<string, () => void>(),
  registerResult: true,
  throwOnRegister: false,
  workArea: { x: 0, y: 0, width: 1920, height: 1080 },
}));

vi.mock('electron', () => {
  class FakeBrowserWindow {
    options: Record<string, unknown>;
    webContents = { send: vi.fn() };
    setAlwaysOnTop = vi.fn();
    setIgnoreMouseEvents = vi.fn();
    setFocusable = vi.fn();
    setOpacity = vi.fn();
    setBounds = vi.fn();
    show = vi.fn();
    hide = vi.fn();
    isVisible = vi.fn(() => false);
    isDestroyed = vi.fn(() => false);
    loadFile = vi.fn();
    loadURL = vi.fn();
    destroy = vi.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.windows.push(this);
    }
  }

  return {
    BrowserWindow: FakeBrowserWindow,
    screen: { getPrimaryDisplay: () => ({ workArea: mocks.workArea }) },
    globalShortcut: {
      register: (accelerator: string, cb: () => void) => {
        // O Electron lança TypeError para aceleradores inválidos (ex.: AltGraph).
        if (mocks.throwOnRegister)
          throw new Error(
            `Error processing argument at index 0, conversion failure from ${accelerator}`
          );
        if (!mocks.registerResult) return false;
        mocks.shortcuts.set(accelerator, cb);
        return true;
      },
      unregister: (accelerator: string) => mocks.shortcuts.delete(accelerator),
      unregisterAll: () => mocks.shortcuts.clear(),
    },
    app: { isPackaged: true, getPath: () => 'C:\\UserData', getAppPath: () => 'C:\\App' },
  };
});

import {
  applyOverlaySettings,
  computeOverlayRect,
  createOverlayWindow,
  destroyOverlayWindow,
  getOverlayWindow,
  hideOverlayWindow,
  registerToggleShortcut,
  showOverlayWindow,
  toggleOverlayWindow,
  updateOverlayFrame,
} from '../overlay-window';

const SETTINGS: OverlaySettings = {
  hotkey: 'Ctrl+Shift+F',
  position: 'top-left',
  opacity: 0.85,
  targetFps: 60,
  onlyWhenFocused: true,
};

function lastWindow(): Record<string, unknown> & {
  webContents: { send: ReturnType<typeof vi.fn> };
  setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
  isVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return mocks.windows[mocks.windows.length - 1] as never;
}

beforeEach(() => {
  mocks.windows.length = 0;
  mocks.shortcuts.clear();
  mocks.registerResult = true;
  mocks.throwOnRegister = false;
  destroyOverlayWindow();
});

describe('computeOverlayRect', () => {
  it.each([
    ['top-left', 24, 24],
    ['top-right', 1920 - 24 - 140, 24],
    ['bottom-left', 24, 1080 - 24 - 44],
    ['bottom-right', 1920 - 24 - 140, 1080 - 24 - 44],
  ] as Array<[OverlayPosition, number, number]>)(
    'posiciona o pill no canto %s',
    (position, x, y) => {
      expect(computeOverlayRect(position, mocks.workArea)).toEqual({
        x,
        y,
        width: 140,
        height: 44,
      });
    }
  );
});

describe('janela do overlay', () => {
  it('cria uma janela transparente que ignora o mouse', () => {
    createOverlayWindow();
    const win = lastWindow();
    expect(win.options).toMatchObject({
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
    });
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });

  it('mostra, esconde e alterna a visibilidade', () => {
    createOverlayWindow();
    const win = lastWindow();
    showOverlayWindow();
    expect(win.show).toHaveBeenCalled();
    hideOverlayWindow();
    expect(win.hide).toHaveBeenCalled();
    win.isVisible.mockReturnValue(false);
    toggleOverlayWindow();
    expect(win.show).toHaveBeenCalled();
  });

  it('publica frames e configurações na janela', () => {
    createOverlayWindow();
    const frame: OverlayFrame = { fps: 90, color: 'good', visible: true };
    updateOverlayFrame(frame);
    applyOverlaySettings(SETTINGS);
    expect(lastWindow().webContents.send).toHaveBeenCalledWith('overlay:frame', frame);
    expect(lastWindow().webContents.send).toHaveBeenCalledWith('overlay:settings', SETTINGS);
  });

  it('registra e troca o atalho global', () => {
    const toggle = vi.fn();
    expect(registerToggleShortcut('Ctrl+Shift+F', toggle)).toBe(true);
    expect(mocks.shortcuts.has('Ctrl+Shift+F')).toBe(true);
    mocks.shortcuts.get('Ctrl+Shift+F')?.();
    expect(toggle).toHaveBeenCalled();

    registerToggleShortcut('F9', toggle);
    expect(mocks.shortcuts.has('Ctrl+Shift+F')).toBe(false);
    expect(mocks.shortcuts.has('F9')).toBe(true);
  });

  it('propaga conflito ao registrar o atalho', () => {
    mocks.registerResult = false;
    expect(registerToggleShortcut('Ctrl+Shift+F', vi.fn())).toBe(false);
  });

  it('não propaga exceção quando o Electron rejeita o acelerador', () => {
    mocks.throwOnRegister = true;
    expect(registerToggleShortcut('AltGraph', vi.fn())).toBe(false);
    expect(mocks.shortcuts.size).toBe(0);
  });

  it('destroi a janela', () => {
    createOverlayWindow();
    const win = lastWindow();
    destroyOverlayWindow();
    expect(win.destroy).toHaveBeenCalled();
    expect(getOverlayWindow()).toBeNull();
  });
});
