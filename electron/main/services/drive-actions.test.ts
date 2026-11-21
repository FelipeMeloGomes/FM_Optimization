import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  spawn: vi.fn(),
  children: [] as EventEmitter[],
}));

vi.mock('node:child_process', () => ({ spawn: h.spawn }));
vi.mock('./admin-check', () => ({ isAdmin: h.isAdmin }));

import {
  DRIVE_LETTER_PATTERN,
  buildDriveActionCommand,
  runDriveAction,
} from './drive-actions';

const ADMIN_ERROR =
  'Este script requer privilégios de administrador. Execute o programa como administrador.';

beforeEach(() => {
  h.isAdmin.mockReset().mockResolvedValue(true);
  h.children = [];
  h.spawn.mockReset().mockImplementation(() => {
    const child = new EventEmitter();
    h.children.push(child);
    return child;
  });
});

describe('buildDriveActionCommand', () => {
  it('monta o cleanmgr para a unidade informada', () => {
    const launch = buildDriveActionCommand('cleanup', 'c');
    expect(launch.command).toBe('powershell.exe');
    expect(launch.args).toEqual(['-NoProfile', '-Command', expect.any(String)]);
    expect(launch.env.FMOPT_CHILD_EXE).toBe('cmd.exe');
    expect(launch.env.FMOPT_CHILD_ARGS).toBe('/c cleanmgr /d C:');
  });

  it('monta o defrag com /O /L na unidade informada', () => {
    expect(buildDriveActionCommand('optimize', 'D').env.FMOPT_CHILD_ARGS).toBe(
      '/c defrag D: /O /L'
    );
  });

  it('rejeita letra que não é uma única letra', () => {
    for (const bad of ['C:', 'C:\\', '', 'CC', '../C']) {
      expect(() => buildDriveActionCommand('cleanup', bad)).toThrow('Unidade inválida');
      expect(DRIVE_LETTER_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('runDriveAction', () => {
  it('exige administrador antes de lançar o processo', async () => {
    h.isAdmin.mockResolvedValue(false);
    await expect(runDriveAction('cleanup', 'C')).rejects.toThrow(ADMIN_ERROR);
    expect(h.spawn).not.toHaveBeenCalled();
  });

  it('lança o wrapper com o ambiente da unidade', async () => {
    const promise = runDriveAction('cleanup', 'c');
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    const [command, args, options] = h.spawn.mock.calls[0];
    expect(command).toBe('powershell.exe');
    expect(args).toEqual(['-NoProfile', '-Command', expect.any(String)]);
    expect(options).toEqual(expect.objectContaining({ windowsHide: true, stdio: 'ignore' }));
    expect(options.env.FMOPT_CHILD_EXE).toBe('cmd.exe');
    expect(options.env.FMOPT_CHILD_ARGS).toBe('/c cleanmgr /d C:');
    h.children[0].emit('close', 0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('só resolve quando o processo filho fecha', async () => {
    const promise = runDriveAction('optimize', 'C');
    await vi.waitFor(() => expect(h.children).toHaveLength(1));
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    h.children[0].emit('close', 0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejeita quando o processo falha ao iniciar', async () => {
    const promise = runDriveAction('optimize', 'C');
    await vi.waitFor(() => expect(h.children).toHaveLength(1));
    h.children[0].emit('error', new Error('spawn ENOENT'));
    await expect(promise).rejects.toThrow('spawn ENOENT');
  });
});
