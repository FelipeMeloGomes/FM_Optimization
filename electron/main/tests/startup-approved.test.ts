import { describe, expect, it } from 'vitest';
import { isStartupApprovedEnabled, startupApprovedHex } from '../services/startup-approved';

function base64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

describe('startupApprovedHex', () => {
  it('writes the 12-byte disabled blob', () => {
    expect(startupApprovedHex(false)).toBe('030000000000000000000000');
  });

  it('writes the 12-byte enabled blob', () => {
    expect(startupApprovedHex(true)).toBe('020000000000000000000000');
  });
});

describe('isStartupApprovedEnabled', () => {
  it('treats a missing value as enabled', () => {
    expect(isStartupApprovedEnabled(null)).toBe(true);
    expect(isStartupApprovedEnabled(undefined)).toBe(true);
    expect(isStartupApprovedEnabled('')).toBe(true);
  });

  it('treats 0x03 as disabled', () => {
    expect(isStartupApprovedEnabled(base64('030000000000000000000000'))).toBe(false);
  });

  it('treats 0x07 as disabled', () => {
    expect(isStartupApprovedEnabled(base64('070000000000000000000000'))).toBe(false);
  });

  it('treats 0x02 and 0x06 as enabled', () => {
    expect(isStartupApprovedEnabled(base64('020000000000000000000000'))).toBe(true);
    expect(isStartupApprovedEnabled(base64('060000000000000000000000'))).toBe(true);
  });

  it('treats an unreadable blob as enabled', () => {
    expect(isStartupApprovedEnabled('!!!')).toBe(true);
  });
});
