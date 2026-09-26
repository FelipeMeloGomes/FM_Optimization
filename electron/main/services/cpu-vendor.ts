import si from 'systeminformation';
import type { CpuVendor } from '../../shared/ipc-types';

export interface CpuIdentity {
  manufacturer?: string;
  vendor?: string;
  model?: string;
}

export type CpuIdentityReader = () => Promise<CpuIdentity>;

/**
 * Only the substrings that unambiguously identify a vendor. Matching runs on an
 * alphanumeric-only lowercase copy, so `Intel(R) Corporation` and
 * `Advanced Micro Devices, Inc.` reduce to `intelrcorporation` and
 * `advancedmicrodevicesinc` respectively.
 */
const INTEL_ALIASES = ['genuineintel', 'intel'];
const AMD_ALIASES = ['authenticamd', 'advancedmicrodevices', 'microdevices', 'amd'];

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchVendor(value: string | undefined): CpuVendor | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (INTEL_ALIASES.some((alias) => normalized.includes(alias))) return 'intel';
  if (AMD_ALIASES.some((alias) => normalized.includes(alias))) return 'amd';
  return null;
}

/**
 * `manufacturer` wins over `vendor` wins over `model`. The model is only a last
 * resort because OEM strings carry both: an Intel-branded Ryzen reports
 * `GenuineIntel` as manufacturer, and a virtualized host reports the hypervisor.
 */
export function normalizeCpuVendor(identity: CpuIdentity): CpuVendor {
  return (
    matchVendor(identity.manufacturer) ??
    matchVendor(identity.vendor) ??
    matchVendor(identity.model) ??
    'unknown'
  );
}

const readSiCpu: CpuIdentityReader = async () => {
  const cpu = await si.cpu();
  return { manufacturer: cpu.manufacturer, vendor: cpu.vendor, model: cpu.model };
};

let cached: CpuIdentity | null = null;
let inflight: Promise<CpuIdentity> | null = null;

/**
 * Reads the CPU identity at most once per process. Concurrent callers share the
 * in-flight promise so the React StrictMode double-mount cannot issue two reads.
 * A failed read is cached as an empty identity: retrying on every call would
 * re-query WMI on every consumer, and `unknown` is the correct outcome anyway.
 */
export async function getCpuIdentityOnce(
  read: CpuIdentityReader = readSiCpu
): Promise<CpuIdentity> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = read()
    .then((identity) => {
      cached = identity;
      return identity;
    })
    .catch(() => {
      cached = {};
      return {};
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetCpuVendorCache(): void {
  cached = null;
  inflight = null;
}
