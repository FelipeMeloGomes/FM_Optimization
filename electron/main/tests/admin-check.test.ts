import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `net session` falha com "System error 5 / Access is denied" quando o app
 * roda sem admin. A falha é esperada e já cai para `whoami /groups`, mas o
 * stderr do filho vazava para o console do Electron e parecia erro de boot.
 */

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({ execSync: mocks.execSync, execFile: vi.fn() }));
vi.mock('../audit-logger', () => ({ auditAdminCheck: vi.fn() }));

import { isAdmin } from '../services/admin-check';

describe('isAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execSync.mockImplementation(() => {
      throw new Error('net session falhou');
    });
  });

  it('descarta o stderr do comando para não poluir o console do app', () => {
    isAdmin();

    expect(mocks.execSync).toHaveBeenCalled();
    const options = mocks.execSync.mock.calls[0][1] as { stdio: string[] };
    expect(options.stdio[2]).toBe('ignore');
  });
});
