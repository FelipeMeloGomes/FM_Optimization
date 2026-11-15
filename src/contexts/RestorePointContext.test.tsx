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

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const {
    state,
    creating,
    restoring,
    isAdmin,
    adminRequired,
    refresh,
    hasFetched,
    create,
    remove,
    restore,
  } = useRestorePointContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="count">{state.status === 'success' ? String(state.data.length) : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="creating">{String(creating)}</span>
      <span data-testid="restoring">{String(restoring)}</span>
      <span data-testid="is-admin">{String(isAdmin)}</span>
      <span data-testid="admin-required">{String(adminRequired)}</span>
      <span data-testid="has-fetched">{String(hasFetched)}</span>
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
  vi.restoreAllMocks();
});

describe('RestorePointProvider', () => {
  it('carrega os pontos e o estado de administrador', async () => {
    installApi();
    renderProvider();

    // Estado inicial é loading, não buscou ainda
    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(screen.getByTestId('has-fetched').textContent).toBe('false');

    // Dispara refresh
    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    await waitFor(() => expect(screen.getByTestId('has-fetched').textContent).toBe('true'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('is-admin').textContent).toBe('true');
    expect(screen.getByTestId('admin-required').textContent).toBe('false');
  });

  it('assume não-admin quando a checagem falha', async () => {
    const api = installApi();
    api.isAdmin.mockResolvedValueOnce(false);
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('is-admin').textContent).toBe('false'));
  });

  it('expõe erro comum sem exigir admin', async () => {
    const api = installApi();
    api.getRestorePoints.mockRejectedValueOnce('falha de rede');
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('admin-required').textContent).toBe('false');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
  });

  it('marca adminRequired quando o erro indica falta de privilégio', async () => {
    const api = installApi();
    api.getRestorePoints.mockRejectedValueOnce('Access denied');
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
  });

  it('cria um ponto, recarrega a lista e controla a flag creating', async () => {
    const api = installApi();
    const { promise, resolve } = deferred();
    api.createRestorePoint.mockReturnValueOnce(promise);
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /criar ponto/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('creating').textContent).toBe('true'));

    await act(async () => {
      resolve();
      api.getRestorePoints.mockResolvedValueOnce(POINTS_NOVO);
    });

    await waitFor(() => expect(screen.getByTestId('creating').textContent).toBe('false'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('trata falha de criação como exigência de admin', async () => {
    const api = installApi();
    api.createRestorePoint.mockRejectedValueOnce('Acesso negado');
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /criar ponto/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('creating').textContent).toBe('false'));
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
  });

  it('remove um ponto e recarrega a lista', async () => {
    const api = installApi();
    const { promise, resolve } = deferred();
    api.deleteRestorePoint.mockReturnValueOnce(promise);
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /remover ponto/i }).click();
    });

    await act(async () => {
      resolve();
      api.getRestorePoints.mockResolvedValueOnce([]);
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('controla restoring durante a restauração', async () => {
    const api = installApi();
    const { promise, resolve } = deferred();
    api.restoreSystem.mockReturnValueOnce(promise);
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /restaurar ponto/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('true'));

    await act(async () => {
      resolve();
    });

    await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  });

  it('expõe falha de restauração e sinaliza admin', async () => {
    const api = installApi();
    api.restoreSystem.mockRejectedValueOnce(new Error('acesso negado'));
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /restaurar ponto/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
    expect(screen.getByTestId('admin-required').textContent).toBe('true');
  });

  it('refresh volta para loading antes de buscar de novo', async () => {
    const api = installApi();
    renderProvider();

    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    // Segunda chamada de refresh com promise controlada que resolve para POINTS_NOVO
    const { promise, resolve } = deferred<RestorePointEntry[]>();
    api.getRestorePoints.mockReturnValueOnce(promise);
    await act(async () => {
      screen.getByRole('button', { name: /atualizar pontos/i }).click();
    });

    // Deve voltar para loading
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('loading'));

    // Resolve a promise com os novos dados
    await act(async () => {
      resolve(POINTS_NOVO);
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });
});

describe('useRestorePointContext', () => {
  it('exige o RestorePointProvider', () => {
    expect(() => render(<Probe />)).toThrow(
      'useRestorePointContext must be used within RestorePointProvider'
    );
  });
});
