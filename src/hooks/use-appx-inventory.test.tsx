// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppxInventory, AppxRemoveResult } from '../../electron/shared/ipc-types';
import { useAppxInventory } from './use-appx-inventory';

/**
 * O hook só orquestra o IPC: busca o inventário ao montar, revarre no refresh e
 * atualiza a lista depois de remover. O cache de verdade (60s) fica no main.
 */

function inventory(overrides: Partial<AppxInventory> = {}): AppxInventory {
  return {
    packages: [
      {
        familyName: 'Microsoft.XboxGamingOverlay_8wekyb3d8bbwe',
        packageName: 'Microsoft.XboxGamingOverlay',
        displayName: 'Xbox Game Bar',
        version: '1.0.0.0',
        publisher: 'CN=Microsoft',
        isFramework: false,
        isProvisioned: false,
        removable: true,
        recommended: true,
      },
    ],
    elevated: true,
    scannedAt: 1000,
    ...overrides,
  };
}

const getAppxInventory = vi.fn<(refresh?: boolean) => Promise<AppxInventory>>();
const removeAppxPackages = vi.fn<(families: string[]) => Promise<AppxRemoveResult>>();

function installApi() {
  getAppxInventory.mockReset();
  getAppxInventory.mockResolvedValue(inventory());
  removeAppxPackages.mockReset();
  removeAppxPackages.mockResolvedValue({
    removed: ['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe'],
    failed: [],
  });
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    getAppxInventory,
    removeAppxPackages,
  };
  return { getAppxInventory, removeAppxPackages };
}

beforeEach(() => {
  installApi();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('useAppxInventory — carga inicial', () => {
  it('começa carregando e preenche o inventário', async () => {
    const { result } = renderHook(() => useAppxInventory());

    expect(result.current.loading).toBe(true);
    expect(result.current.inventory).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAppxInventory).toHaveBeenCalledTimes(1);
    expect(result.current.inventory?.packages[0].displayName).toBe('Xbox Game Bar');
    expect(result.current.lastRefreshed).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('encerra o loading com erro quando a varredura falha', async () => {
    getAppxInventory.mockRejectedValue(new Error('acesso negado'));

    const { result } = renderHook(() => useAppxInventory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.inventory).toBeNull();
    expect(result.current.error).toBe('acesso negado');
  });
});

describe('useAppxInventory — atualização e remoção', () => {
  it('refresh força uma nova varredura no main', async () => {
    const { result } = renderHook(() => useAppxInventory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(getAppxInventory).toHaveBeenLastCalledWith(true);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('remove repassa as famílias e busca o inventário atualizado', async () => {
    const { result } = renderHook(() => useAppxInventory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let removed!: AppxRemoveResult;
    await act(async () => {
      removed = await result.current.remove(['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe']);
    });

    expect(removeAppxPackages).toHaveBeenCalledWith(['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe']);
    expect(getAppxInventory).toHaveBeenLastCalledWith(true);
    expect(removed.removed).toEqual(['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe']);
  });

  it('expõe o erro da remoção e mantém o inventário atual', async () => {
    const { result } = renderHook(() => useAppxInventory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    removeAppxPackages.mockRejectedValue(new Error('requer administrador'));

    await act(async () => {
      await expect(
        result.current.remove(['Microsoft.XboxGamingOverlay_8wekyb3d8bbwe'])
      ).rejects.toThrow(/administrador/);
    });

    expect(result.current.error).toBe('requer administrador');
    expect(result.current.inventory?.packages).toHaveLength(1);
  });
});
