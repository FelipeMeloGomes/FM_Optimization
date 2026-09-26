import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, isExtensionAllowed } from '../deny-list';

describe('isExtensionAllowed', () => {
  it('rejects .txt now that the guide feature is gone', () => {
    expect(isExtensionAllowed('.txt')).toBe(false);
  });

  it('keeps the executable script extensions allowed', () => {
    for (const ext of ['.bat', '.cmd', '.ps1', '.reg', '.exe']) {
      expect(isExtensionAllowed(ext)).toBe(true);
    }
  });

  it('is case insensitive', () => {
    expect(isExtensionAllowed('.BAT')).toBe(true);
    expect(isExtensionAllowed('.TXT')).toBe(false);
  });

  it('rejects anything outside the allowlist', () => {
    for (const ext of ['.sh', '.py', '.js', '.dll', '.msi', '']) {
      expect(isExtensionAllowed(ext)).toBe(false);
    }
  });
});

describe('ALLOWED_EXTENSIONS', () => {
  it('no longer lists .txt', () => {
    expect(ALLOWED_EXTENSIONS).not.toContain('.txt');
    expect(ALLOWED_EXTENSIONS).toHaveLength(5);
  });
});
