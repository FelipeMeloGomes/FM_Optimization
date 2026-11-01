import { describe, expect, it } from 'vitest';
import {
  ALLOWED_EXTENSIONS,
  checkScriptContent,
  isExtensionAllowed,
  shouldBlockScript,
} from '../deny-list';

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
  it('reports a denied pattern as not allowed', () => {
    // O catálogo é conteúdo interno e versionado, então vários scripts
    // legítimos usam bcdedit. A detecção precisa ser honesta (allowed: false);
    // quem decide bloquear é shouldBlockScript, com a flag de segurança.
    const result = checkScriptContent('@echo off\r\nbcdedit /set testsigning yes');
    expect(result.violations).toEqual(['\\bbcdedit\\b']);
    expect(result.allowed).toBe(false);
  });

  it('reports no violations for clean content', () => {
    expect(checkScriptContent('@echo off\r\necho hello')).toEqual({
      allowed: true,
      violations: [],
    });
  });
});

describe('shouldBlockScript', () => {
  it('bloqueia apenas com a flag ligada e alguma violacao', () => {
    expect(shouldBlockScript(['\\bbcdedit\\b'], true)).toBe(true);
    expect(shouldBlockScript(['\\bbcdedit\\b'], false)).toBe(false);
    expect(shouldBlockScript([], true)).toBe(false);
    expect(shouldBlockScript([], false)).toBe(false);
  });
});
