import { useCallback, useMemo } from 'react';
import type { CpuVendor } from '../../electron/shared/ipc-types';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useCpuContext } from '../contexts/SystemContext';
import { getCpuCategories } from '../lib/cpu-vendor';

interface UseCpuVendor {
  detected: CpuVendor;
  effective: CpuVendor;
  categories: string[];
  isManual: boolean;
  setOverride: (vendor: CpuVendor) => void;
  clearOverride: () => void;
}

export function useCpuVendor(): UseCpuVendor {
  const { state } = useCpuContext();
  const { settings, update } = useSettingsContext();

  const detected = useMemo<CpuVendor>(
    () => (state.status === 'success' ? state.data.vendor : 'unknown'),
    [state]
  );

  const override = settings.cpuVendorOverride;

  // A confident detection always wins, so a stale override can never mask it.
  const effective: CpuVendor = detected !== 'unknown' ? detected : (override ?? 'unknown');

  const setOverride = useCallback(
    (vendor: CpuVendor) => update({ cpuVendorOverride: vendor === 'unknown' ? null : vendor }),
    [update]
  );

  const clearOverride = useCallback(() => update({ cpuVendorOverride: null }), [update]);

  return {
    detected,
    effective,
    categories: getCpuCategories(),
    isManual: override !== null && detected === 'unknown',
    setOverride,
    clearOverride,
  };
}
