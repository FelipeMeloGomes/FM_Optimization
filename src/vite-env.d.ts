/// <reference types="vite/client" />

import type { ElectronAPI } from '../electron/shared/ipc-types';
import type { OverlayApi } from '../electron/shared/overlay-types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    overlayAPI: OverlayApi;
  }
}
