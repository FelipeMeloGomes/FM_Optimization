/** Valores expostos pelo Windows para as configurações de mouse. */
export interface MouseSettings {
  /** SPI_GETMOUSESPEED: 1 (lento) a 20 (rápido), padrão 10. */
  pointerSpeed: number;
  /** true quando os limiares de aceleração do Windows estão ativos. */
  enhancedPrecision: boolean;
  /** SPI_GETDOUBLECLICKTIME em milissegundos (100 a 5000). */
  doubleClickSpeed: number;
}

export const MOUSE_POINTER_SPEED_MIN = 1;
export const MOUSE_POINTER_SPEED_MAX = 20;
export const MOUSE_DOUBLE_CLICK_MIN = 100;
export const MOUSE_DOUBLE_CLICK_MAX = 5000;

export const DEFAULT_MOUSE_SETTINGS: MouseSettings = {
  pointerSpeed: 10,
  enhancedPrecision: true,
  doubleClickSpeed: 500,
};
