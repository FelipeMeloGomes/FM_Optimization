// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => vi.fn());

vi.mock('../components/EnhancedToast', () => ({
  showEnhancedToast: toasts,
}));

import { useAdminStatus } from './use-admin-status';

const elevateApp = vi.fn();
const isAdmin = vi.fn();

beforeEach(() => {
  toasts.mockReset();
  elevateApp.mockReset();
  isAdmin.mockReset();
  isAdmin.mockResolvedValue(true);
  elevateApp.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: unknown }).electronAPI = { elevateApp, isAdmin };
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useAdminStatus', () => {
  it('começa como pendente e resolve o status com isAdmin', async () => {
    const { result } = renderHook(() => useAdminStatus({ soundEnabled: false }));

    expect(result.current.isAdmin).toBeNull();
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(isAdmin).toHaveBeenCalledTimes(1);
  });

  it('trata falha ao consultar como não administrador', async () => {
    isAdmin.mockRejectedValueOnce(new Error('sem IPC'));
    const { result } = renderHook(() => useAdminStatus({ soundEnabled: false }));

    await waitFor(() => expect(result.current.isAdmin).toBe(false));
  });

  it('usa status externo sem consultar isAdmin', async () => {
    const { result } = renderHook(() =>
      useAdminStatus({ soundEnabled: false, externalIsAdmin: false })
    );

    expect(result.current.isAdmin).toBe(false);
    await Promise.resolve();
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it('reinicia como admin com os argumentos canônicos e sem toast no sucesso', async () => {
    const { result } = renderHook(() => useAdminStatus({ soundEnabled: true }));

    await act(async () => {
      await result.current.relaunchAsAdmin();
    });

    expect(elevateApp).toHaveBeenCalledWith(undefined, undefined, undefined, true);
    expect(toasts).not.toHaveBeenCalled();
    expect(result.current.elevating).toBe(false);
  });

  it('mostra o toast padrão quando a elevação falha', async () => {
    elevateApp.mockRejectedValueOnce(new Error('negado'));
    const { result } = renderHook(() => useAdminStatus({ soundEnabled: true }));

    await act(async () => {
      await result.current.relaunchAsAdmin();
    });

    expect(toasts).toHaveBeenCalledWith({
      type: 'error',
      title: 'Não foi possível reiniciar como admin',
      description: 'negado',
      duration: 'long',
      sound: true,
    });
    expect(result.current.elevating).toBe(false);
  });

  it('marca elevando durante a solicitação', async () => {
    let resolveElevation: (() => void) | undefined;
    elevateApp.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveElevation = resolve;
        })
    );
    const { result } = renderHook(() => useAdminStatus({ soundEnabled: false }));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.relaunchAsAdmin();
    });

    await waitFor(() => expect(result.current.elevating).toBe(true));
    await act(async () => {
      resolveElevation?.();
      await pending;
    });

    expect(result.current.elevating).toBe(false);
  });
});
