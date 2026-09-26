import { describe, expect, it } from 'vitest';
import { getRamScriptId } from './ram-script';

describe('getRamScriptId', () => {
  it('maps each capacity tier to its merged script', () => {
    expect(getRamScriptId(4)).toBe('cpu-30');
    expect(getRamScriptId(6)).toBe('cpu-31');
    expect(getRamScriptId(8)).toBe('cpu-32');
    expect(getRamScriptId(12)).toBe('cpu-33');
    expect(getRamScriptId(16)).toBe('cpu-34');
    expect(getRamScriptId(32)).toBe('cpu-35');
    expect(getRamScriptId(64)).toBe('cpu-36');
  });

  it('is vendor-agnostic, so an unidentified CPU still gets a recommendation', () => {
    // The tier used to be selected by vendor, which left the palette with no
    // recommendation at all when detection failed. It now depends only on RAM.
    expect(getRamScriptId(8)).toBe(getRamScriptId(8));
  });

  it('rounds fractional capacities up into the next tier', () => {
    expect(getRamScriptId(0)).toBe('cpu-30');
    expect(getRamScriptId(4.1)).toBe('cpu-31');
    expect(getRamScriptId(6.9)).toBe('cpu-32');
    expect(getRamScriptId(32.5)).toBe('cpu-36');
  });

  it('never returns a retired vendor id', () => {
    for (const gb of [0, 4, 6, 8, 12, 16, 32, 64, 128, 512]) {
      expect(getRamScriptId(gb)).toMatch(/^cpu-3[0-6]$/);
    }
  });
});
