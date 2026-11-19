import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { OverlayFrame, OverlaySettings } from '../electron/shared/overlay-types';

type OverlayBridge = {
  onFrame(cb: (frame: OverlayFrame) => void): () => void;
  onSettings(cb: (settings: OverlaySettings) => void): () => void;
};

const mocks = vi.hoisted(() => ({
  exposed: null as unknown,
  key: '',
  listeners: new Map<string, (event: unknown, data: unknown) => void>(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => {
      mocks.key = key;
      mocks.exposed = api;
    },
  },
  ipcRenderer: {
    on: (channel: string, cb: (event: unknown, data: unknown) => void) => {
      mocks.listeners.set(channel, cb);
    },
    removeListener: (channel: string) => {
      mocks.listeners.delete(channel);
    },
  },
}));

beforeAll(async () => {
  await import('../electron/preload/overlay');
});

function api(): OverlayBridge {
  return mocks.exposed as OverlayBridge;
}

describe('bridge do overlay', () => {
  it('expõe a API no mundo principal com a chave overlayAPI', () => {
    expect(mocks.key).toBe('overlayAPI');
    expect(typeof api().onFrame).toBe('function');
    expect(typeof api().onSettings).toBe('function');
  });

  it('repassa frames do canal overlay:frame', () => {
    const cb = vi.fn();
    const unsubscribe = api().onFrame(cb);
    mocks.listeners.get('overlay:frame')?.({}, { fps: 144, color: 'good', visible: true });
    expect(cb).toHaveBeenCalledWith({ fps: 144, color: 'good', visible: true });
    unsubscribe();
    expect(mocks.listeners.has('overlay:frame')).toBe(false);
  });

  it('repassa configurações do canal overlay:settings', () => {
    const cb = vi.fn();
    api().onSettings(cb);
    const settings: OverlaySettings = {
      hotkey: 'Ctrl+Shift+F',
      position: 'top-right',
      opacity: 0.9,
      targetFps: 60,
      onlyWhenFocused: true,
    };
    mocks.listeners.get('overlay:settings')?.({}, settings);
    expect(cb).toHaveBeenCalledWith(settings);
  });
});
