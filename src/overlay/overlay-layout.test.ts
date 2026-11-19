import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '../..');
const css = readFileSync(join(repoRoot, 'src/overlay/overlay.css'), 'utf8');
const windowSource = readFileSync(join(repoRoot, 'electron/main/overlay-window.ts'), 'utf8');

function rule(selector: string): string {
  return new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function declaration(ruleBody: string, property: string): string {
  return new RegExp(`${property}:\\s*([^;]+);`).exec(ruleBody)?.[1]?.trim() ?? '';
}

function firstPixel(value: string): number {
  return Number(/^(-?\d+(?:\.\d+)?)px/.exec(value)?.[1] ?? 0);
}

describe('layout do pill de FPS', () => {
  it('cabe inteiro dentro da janela do overlay', () => {
    const windowHeight = Number(/const HEIGHT = (\d+)/.exec(windowSource)?.[1]);
    const pillRule = rule('.fps-value');
    const numberRule = rule('.fps-number');

    const marginTop = firstPixel(declaration(pillRule, 'margin'));
    const paddingVertical = firstPixel(declaration(pillRule, 'padding')) * 2;
    const fontSize = firstPixel(declaration(numberRule, 'font-size'));
    const needed = marginTop + paddingVertical + fontSize;

    expect(Number.isFinite(windowHeight)).toBe(true);
    expect(fontSize).toBeGreaterThan(0);
    expect(needed).toBeLessThanOrEqual(windowHeight);
  });
});
