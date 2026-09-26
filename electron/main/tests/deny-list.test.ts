import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, checkScriptContent, isExtensionAllowed } from '../deny-list';

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

describe('checkScriptContent', () => {
  it('collects violations but still reports the script as allowed', () => {
    // Known debt: the function returns `allowed: true` unconditionally, so the
    // `allowed` check in script-registry.ts never throws. Wiring it up needs a
    // per-script allowlist first, because 16 catalog scripts (amd-1, intel-1,
    // amd-15, intel-8, tweaks-4, builtin-13 and the cleanup sets) legitimately
    // use bcdedit. See electron/main/tests/script-catalog.test.ts for the
    // catalog-side characterisation.
    const result = checkScriptContent('@echo off\r\nbcdedit /set testsigning yes');
    expect(result.violations).toEqual(['\\bbcdedit\\b']);
    expect(result.allowed).toBe(true);
  });

  it('reports no violations for clean content', () => {
    expect(checkScriptContent('@echo off\r\necho hello')).toEqual({
      allowed: true,
      violations: [],
    });
  });
});
