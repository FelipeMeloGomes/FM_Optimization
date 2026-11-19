import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(resolve(__dirname, '../electron.vite.config.ts'), 'utf8');

describe('entradas de build do overlay', () => {
  it('gera a janela do overlay e o preload separado', () => {
    expect(config).toContain("overlay: resolve(__dirname, 'overlay.html')");
    expect(config).toContain("overlay: resolve(__dirname, 'electron/preload/overlay.ts')");
  });

  it('carrega o preload correto a partir da janela do overlay', () => {
    const windowSource = readFileSync(
      resolve(__dirname, '../electron/main/overlay-window.ts'),
      'utf8'
    );
    expect(windowSource).toContain("join(__dirname, '../preload/overlay.js')");
  });
});
