// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RestorePointEntry } from '../../electron/shared/ipc-types';

import { RestorePointProvider, useRestorePointContext } from './RestorePointContext';

const POINTS: RestorePointEntry[] = [
  {
    sequenceNumber: 5,
    description: 'Antes da otimização',
    creationTime: '2025-01-01T10:00:00.000Z',
    eventType: 'BEGIN_SYSTEM_CHANGE',
  },
];

const POINTS_NOVO: RestorePointEntry[] = [
  ...POINTS,
  {
    sequenceNumber: 6,
    description: 'Depois da otimização',
    creationTime: '2025-01-02T10:00:00.000Z',
    eventType: 'BEGIN_SYSTEM_CHANGE',
  },
];

function installApi() {
  const api = {
    getRestorePoints: vi.fn<() => Promise<RestorePointEntry[]>>(async () => POINTS),
    isAdmin: vi.fn<() => Promise<boolean>>(async () => true),
    createRestorePoint: vi.fn<(name: string) => Promise<void>>(async () => undefined),
    deleteRestorePoint: vi.fn<(seq: number) => Promise<void>>(async () => undefined),
    restoreSystem: vi.fn<(seq: number) => Promise<void>>(async () => undefined),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const { state, creating, restoring, isAdmin, adminRequired, refresh, create, remove, restore } =
    useRestorePointContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="count">{state.status === 'success' ? String(state.data.length) : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="creating">{String(creating)}</span>
      <span data-testid="restoring">{String(restoring)}</span>
      <span data-testid="is-admin">{String(isAdmin)}</span>
      <span data-testid="admin-required">{String(adminRequired)}</span>
      <button type="button" onClick={refresh}>
        atualizar pontos
      </button>
      <button
        type="button"
        onClick={() => {
          void create('novo ponto');
        }}
      >
        criar ponto
      </button>
      <button
        type="button"
        onClick={() => {
          void remove(5);
        }}
      >
        remover ponto
      </button>
      <button
        type="button"
        onClick={() => {
          void restore(5);
        }}
      >
        restaurar ponto
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <RestorePointProvider>
      <Probe />
    </RestorePointProvider>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('RestorePointProvider', () => {
  it('carrega os pontos e o estado de administrador', async () => {
    installApi();
    renderProvider();

    expect(screen.getByTestId('status').textContent).toBe('loading');

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    await waitFor(() => expect(screen.getByTestId('is-admin').textContent).toBe('true'));
    expect(screen.getByTestId('admin-required').textContent).toBe('false');
  });

  it('assume não-admin quando a checagem falha', async () => {
    const api = installApi();
    api.isAdmin.mockRejectedValue(new Error('sem contexto'));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-admin').textContent).toBe('false'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
  });

  it('expõe erro comum sem exigir admin', async () => {
    const api = installApi();
    api.getRestorePoints.mockRejectedValue(new Error('WMI indisponível'));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('WMI indisponível');
    expect(screen.getByTestId('admin-required').textContent).toBe('false');
  });

  it('marca adminRequired quando o erro indica falta de privilégio', async () => {
    const api = installApi();
    api.getRestorePoints.mockRejectedValue(new Error('Access denied'));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
  });

  it('cria um ponto, recarrega a lista e controla o flag creating', async () => {
    const api = installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const pending = deferred();
    api.createRestorePoint.mockImplementation(() => pending.promise);
    api.getRestorePoints.mockResolvedValue(POINTS_NOVO);

    act(() => screen.getByRole('button', { name: 'criar ponto' }).click());
    expect(screen.getByTestId('creating').textContent).toBe('true');

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(api.createRestorePoint).toHaveBeenCalledWith('novo ponto');
    expect(api.getRestorePoints).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    expect(screen.getByTestId('creating').textContent).toBe('false');
  });

  it('trata falha de criação como exigência de admin', async () => {
    const api = installApi();
    api.createRestorePoint.mockRejectedValue('Acesso negado');
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    await act(async () => screen.getByRole('button', { name: 'criar ponto' }).click());

    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('error').textContent).toBe('Acesso negado');
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
    expect(screen.getByTestId('creating').textContent).toBe('false');
  });

  it('remove o ponto e recarrega a lista', async () => {
    const api = installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    api.getRestorePoints.mockResolvedValue([]);
    await act(async () => screen.getByRole('button', { name: 'remover ponto' }).click());

    expect(api.deleteRestorePoint).toHaveBeenCalledWith(5);
    expect(api.getRestorePoints).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('controla restoring durante a restauração', async () => {
    const api = installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const pending = deferred();
    api.restoreSystem.mockImplementation(() => pending.promise);

    act(() => screen.getByRole('button', { name: 'restaurar ponto' }).click());
    expect(screen.getByTestId('restoring').textContent).toBe('true');

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(api.restoreSystem).toHaveBeenCalledWith(5);
    expect(screen.getByTestId('restoring').textContent).toBe('false');
  });

  it('expõe falha de restauração e sinaliza admin', async () => {
    const api = installApi();
    api.restoreSystem.mockRejectedValue(new Error('acesso negado'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    await act(async () => screen.getByRole('button', { name: 'restaurar ponto' }).click());

    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
    expect(screen.getByTestId('restoring').textContent).toBe('false');
  });

  it('refresh volta para loading antes de buscar de novo', async () => {
    const api = installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const pending = deferred();
    api.getRestorePoints.mockImplementation(
      () =>
        new Promise<RestorePointEntry[]>((resolve) => {
          pending.promise.then(() => resolve(POINTS_NOVO));
        })
    );

    act(() => screen.getByRole('button', { name: 'atualizar pontos' }).click());
    expect(screen.getByTestId('status').textContent).toBe('loading');

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });
});

describe('useRestorePointContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useRestorePointContext must be used within RestorePointProvider'
    );

    consoleError.mockRestore();
  });
});
