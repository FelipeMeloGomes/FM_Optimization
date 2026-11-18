export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const DARK_FOREGROUND = '#0a0b10';
const LIGHT_FOREGROUND = '#ffffff';
const DARK_RGB: Rgb = { r: 10, g: 11, b: 16 };
const LIGHT_RGB: Rgb = { r: 255, g: 255, b: 255 };
const MIN_CONTRAST = 4.5;

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));

  return {
    r: Math.round(channel(0) * 255),
    g: Math.round(channel(8) * 255),
    b: Math.round(channel(4) * 255),
  };
}

function linearize(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Escolhe o foreground com maior contraste sobre a cor de fundo. Quando nem
 * texto escuro nem claro atinge 4,5:1, ajusta a luminosidade do fundo no
 * sentido que aumenta o contraste (claro para texto escuro, escuro para
 * texto claro) até encontrar um par legível.
 */
export function readableForeground(background: Hsl): {
  foreground: string;
  background: Hsl;
} {
  let lightness = background.l;

  for (let step = 0; step <= 100; step += 1) {
    const candidate = { ...background, l: lightness };
    const rgb = hslToRgb(candidate);
    const darkContrast = contrastRatio(rgb, DARK_RGB);
    const lightContrast = contrastRatio(rgb, LIGHT_RGB);
    const useDark = darkContrast >= lightContrast;

    if (Math.max(darkContrast, lightContrast) >= MIN_CONTRAST) {
      return {
        foreground: useDark ? DARK_FOREGROUND : LIGHT_FOREGROUND,
        background: candidate,
      };
    }

    lightness = useDark ? Math.min(100, lightness + 1) : Math.max(0, lightness - 1);
  }

  return { foreground: LIGHT_FOREGROUND, background: { ...background, l: 0 } };
}
