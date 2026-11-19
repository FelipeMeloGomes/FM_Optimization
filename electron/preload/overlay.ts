import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import type { OverlayFrame, OverlaySettings } from '../shared/overlay-types';

function onChannel<T>(channel: string, cb: (data: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, data: T): void => cb(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('overlayAPI', {
  onFrame: (cb: (frame: OverlayFrame) => void) => onChannel('overlay:frame', cb),
  onSettings: (cb: (settings: OverlaySettings) => void) => onChannel('overlay:settings', cb),
});
