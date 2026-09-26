import { describe, expect, it } from 'vitest';
import { CPU_CATEGORY, getCpuCategories } from './cpu-vendor';

describe('getCpuCategories', () => {
  it('returns the single merged category', () => {
    expect(getCpuCategories()).toEqual(['CPU']);
  });

  it('takes no vendor, so detection cannot change what is listed', () => {
    // The vendor argument used to pick between 'AMD' and 'Intel'. Both sets were
    // merged, so the page always shows the same 37 scripts.
    expect(getCpuCategories.length).toBe(0);
  });

  it('names the category CPU', () => {
    expect(CPU_CATEGORY).toBe('CPU');
  });
});
