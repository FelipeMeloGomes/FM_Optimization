import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CpuIdentity,
  getCpuIdentityOnce,
  normalizeCpuVendor,
  resetCpuVendorCache,
} from '../services/cpu-vendor';

afterEach(() => {
  resetCpuVendorCache();
});

describe('normalizeCpuVendor', () => {
  it('recognises GenuineIntel', () => {
    expect(normalizeCpuVendor({ manufacturer: 'GenuineIntel' })).toBe('intel');
  });

  it('recognises the Intel vendor string', () => {
    expect(normalizeCpuVendor({ vendor: 'Intel(R) Corporation' })).toBe('intel');
  });

  it('recognises AuthenticAMD', () => {
    expect(normalizeCpuVendor({ manufacturer: 'AuthenticAMD' })).toBe('amd');
  });

  it('recognises Advanced Micro Devices, which never contains the token "amd"', () => {
    expect(normalizeCpuVendor({ vendor: 'Advanced Micro Devices, Inc.' })).toBe('amd');
  });

  it('falls back to the model string', () => {
    expect(normalizeCpuVendor({ model: 'AMD Ryzen 9 5950X' })).toBe('amd');
    expect(normalizeCpuVendor({ model: 'Intel(R) Core(TM) i7-10700K CPU @ 2.90GHz' })).toBe(
      'intel'
    );
  });

  it('prefers manufacturer over vendor over model', () => {
    // An Intel-branded Ryzen reports GenuineIntel as manufacturer.
    expect(normalizeCpuVendor({ manufacturer: 'GenuineIntel', model: 'AMD Ryzen 9 5950X' })).toBe(
      'intel'
    );
    expect(normalizeCpuVendor({ vendor: 'AuthenticAMD', model: 'Intel Core i5' })).toBe('amd');
  });

  it('skips an unrecognised manufacturer and still reads the model', () => {
    expect(
      normalizeCpuVendor({ manufacturer: 'Microsoft Corporation', model: 'Intel Xeon Platinum' })
    ).toBe('intel');
  });

  it('returns unknown for an empty identity', () => {
    expect(normalizeCpuVendor({})).toBe('unknown');
    expect(normalizeCpuVendor({ manufacturer: '', vendor: '', model: '' })).toBe('unknown');
  });

  it('returns unknown for non-x86 vendors', () => {
    expect(
      normalizeCpuVendor({ manufacturer: 'Qualcomm Technologies, Inc', model: 'Snapdragon 8cx' })
    ).toBe('unknown');
    expect(normalizeCpuVendor({ manufacturer: '', model: 'Apple M2 Pro' })).toBe('unknown');
  });

  it('returns unknown when every field is undefined', () => {
    expect(normalizeCpuVendor({ manufacturer: undefined, vendor: undefined })).toBe('unknown');
  });
});

describe('getCpuIdentityOnce', () => {
  const identity: CpuIdentity = { manufacturer: 'GenuineIntel', model: 'Core i7' };

  it('reads the identity once across sequential calls', async () => {
    const read = vi.fn().mockResolvedValue(identity);
    const first = await getCpuIdentityOnce(read);
    const second = await getCpuIdentityOnce(read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first).toBe(identity);
    expect(second).toBe(identity);
  });

  it('shares a single in-flight read between concurrent callers', async () => {
    // React StrictMode double-mounts, so the second call arrives before the first
    // has settled.
    const read = vi.fn().mockResolvedValue(identity);
    const [a, b] = await Promise.all([getCpuIdentityOnce(read), getCpuIdentityOnce(read)]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(a).toBe(identity);
    expect(b).toBe(identity);
  });

  it('caches a failed read as an unknown identity instead of retrying', async () => {
    const read = vi.fn().mockRejectedValue(new Error('WMI unavailable'));
    await expect(getCpuIdentityOnce(read)).resolves.toEqual({});
    await expect(getCpuIdentityOnce(read)).resolves.toEqual({});
    expect(read).toHaveBeenCalledTimes(1);
    expect(normalizeCpuVendor({})).toBe('unknown');
  });

  it('reads again after the cache is reset', async () => {
    const read = vi.fn().mockResolvedValue(identity);
    await getCpuIdentityOnce(read);
    resetCpuVendorCache();
    await getCpuIdentityOnce(read);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
