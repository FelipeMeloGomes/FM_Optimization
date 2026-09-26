export type { CpuVendor } from '../../electron/shared/ipc-types';

/**
 * Every processor tweak in the catalog lives under this one category. The
 * former AMD/Intel split was folder organisation only: all 37 pairs were
 * byte-identical or differed solely in banner/credit lines, so there was no
 * vendor-gated content to filter on. Detection still runs and the manual
 * override still persists, but they now label the page instead of splitting it.
 */
export const CPU_CATEGORY = 'CPU';

export function getCpuCategories(): string[] {
  return [CPU_CATEGORY];
}
