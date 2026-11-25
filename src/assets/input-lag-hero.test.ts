// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const svg = readFileSync(new URL('./input-lag-hero.svg', import.meta.url), 'utf8');
const AXIS = 870;

type Point = { x: number; y: number };

/** coleta os vértices explícitos de um path com M, h, c, s e z */
function vertices(d: string): Point[] {
  const tokens = d.match(/[Mhcsz]|-?\d*\.?\d+/g) ?? [];
  const points: Point[] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];

    if (cmd === 'M') {
      x = num();
      y = num();
      startX = x;
      startY = y;
      points.push({ x, y });
      continue;
    }
    if (cmd === 'h') {
      while (i < tokens.length && !Number.isNaN(Number(tokens[i]))) {
        x += num();
        points.push({ x, y });
      }
      continue;
    }
    if (cmd === 'c') {
      while (i < tokens.length && !Number.isNaN(Number(tokens[i]))) {
        num();
        num();
        num();
        num();
        x += num();
        y += num();
        points.push({ x, y });
      }
      continue;
    }
    if (cmd === 's') {
      while (i < tokens.length && !Number.isNaN(Number(tokens[i]))) {
        num();
        num();
        x += num();
        y += num();
        points.push({ x, y });
      }
      continue;
    }
    if (cmd === 'z') {
      x = startX;
      y = startY;
      points.push({ x, y });
      continue;
    }
    throw new Error(`comando não suportado no path: ${cmd}`);
  }
  return points;
}

describe('input-lag-hero.svg', () => {
  it('mantém o corpo do gamepad simétrico, sem segmento reto no fechamento', () => {
    const body = svg.match(/<path d="([^"]+)" fill="url\(#body\)"/)?.[1];
    expect(body).toBeDefined();

    const points = vertices(body as string);
    const start = points[0];
    const beforeClose = points[points.length - 2];

    expect(beforeClose.x).toBeCloseTo(start.x, 3);
    expect(beforeClose.y).toBeCloseTo(start.y, 3);

    const xs = points.map((point) => point.x);
    for (const x of xs) {
      const mirror = 2 * AXIS - x;
      expect(
        xs.some((other) => Math.abs(other - mirror) < 0.01),
        `x=${x}`
      ).toBe(true);
    }
  });

  it('posiciona as alças inferior esquerda e direita em lados opostos', () => {
    const grips = [...svg.matchAll(/<path d="M(\d+) 358[^"]*" fill="url\(#grip\)"/g)].map((match) =>
      Number(match[1])
    );

    expect(grips).toHaveLength(2);
    expect(grips[0] + grips[1]).toBe(2 * AXIS);
  });
});
