import { describe, expect, it } from 'vitest';
import {
  CPU_CATEGORY,
  GPU_CATEGORY,
  getPerformanceCategories,
  WINDOWS_CATEGORY,
} from './cpu-vendor';

describe('getPerformanceCategories', () => {
  it('lists the three buckets the Desempenho page renders', () => {
    expect(getPerformanceCategories()).toEqual([CPU_CATEGORY, GPU_CATEGORY, WINDOWS_CATEGORY]);
  });

  it('takes no vendor, so detection cannot change what is listed', () => {
    // The vendor argument used to pick between 'AMD' and 'Intel'. Both sets were
    // merged, so the page always shows the same scripts regardless of vendor.
    expect(getPerformanceCategories.length).toBe(0);
  });

  it('names the buckets the catalog uses', () => {
    expect(CPU_CATEGORY).toBe('CPU');
    expect(GPU_CATEGORY).toBe('GPU');
    expect(WINDOWS_CATEGORY).toBe('Windows');
  });
});
