/** Modo de vídeo oferecido pelo Windows para um monitor. */
export interface DisplayMode {
  width: number;
  height: number;
  frequency: number;
}

/** Monitor ativo, com o modo atual e todos os modos que o driver oferece. */
export interface DisplayMonitor extends DisplayMode {
  deviceName: string;
  label: string;
  isPrimary: boolean;
  modes: DisplayMode[];
}

export interface DisplaySettings {
  monitors: DisplayMonitor[];
}

/** Um modo escolhido para um monitor específico (envio pelo IPC). */
export interface ApplyDisplaySettingsPayload {
  deviceName: string;
  mode: DisplayMode;
}

export const DISPLAY_MIN_WIDTH = 640;
export const DISPLAY_MIN_HEIGHT = 480;
export const DISPLAY_MIN_FREQUENCY = 30;
export const DISPLAY_MAX_FREQUENCY = 500;
