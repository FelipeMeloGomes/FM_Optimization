/** Ajustes reais de teclado do Windows lidos via SystemParametersInfo. */
export interface KeyboardSettings {
  /** 0–3: atraso até começar a repetir (250, 500, 750 ou 1000 ms). */
  repeatDelay: number;
  /** 0–31: velocidade de repetição das teclas. */
  repeatRate: number;
  /** 100–2500 ms: tempo de piscagem do cursor de texto. */
  caretBlinkRate: number;
}

export const KEYBOARD_REPEAT_DELAY_MIN = 0;
export const KEYBOARD_REPEAT_DELAY_MAX = 3;
export const KEYBOARD_REPEAT_RATE_MIN = 0;
export const KEYBOARD_REPEAT_RATE_MAX = 31;
export const KEYBOARD_BLINK_MIN = 100;
export const KEYBOARD_BLINK_MAX = 2500;

export const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
  repeatDelay: 1,
  repeatRate: 31,
  caretBlinkRate: 530,
};
