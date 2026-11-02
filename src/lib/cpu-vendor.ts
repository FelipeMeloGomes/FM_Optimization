export type { CpuVendor } from '../../electron/shared/ipc-types';

/**
 * The processor scripts still live under one catalog category, but the page
 * that lists them ("Desempenho") also owns two other buckets: GPU tweaks that
 * only work on AMD cards and Windows-level tweaks (power, services, priority).
 * Keeping them as separate categories is what lets the page show each group in
 * its own card — and stops an AMD GPU tweak from being presented as a universal
 * CPU tweak.
 *
 * Detection still runs and the manual override still persists, but they only
 * label the page: vendor never decides what is listed.
 */
export const CPU_CATEGORY = 'CPU';
export const GPU_CATEGORY = 'GPU';
export const WINDOWS_CATEGORY = 'Windows';

export function getPerformanceCategories(): string[] {
  return [CPU_CATEGORY, GPU_CATEGORY, WINDOWS_CATEGORY];
}
