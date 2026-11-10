// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, CpuInfo, CpuVendor } from '../../electron/shared/ipc-types';

/**
 * Regra do hook: a detecção confiável sempre vence o override manual; o override
 * só decide algo quando a detecção devolve "unknown". O teste cobre as quatro
 * combinações e a gravação do override nas configurações.
 */

const store = vi.hoisted(() => ({
  cpuState: { status: 'loading' } as AsyncState<CpuInfo>,
  override: null as CpuVendor | null,
  update: vi.fn(),
}));

vi.mock('../contexts/SystemContext', () => ({
  useCpuContext: () => ({ state: store.cpuState, refreshing: false, refresh: () => {} }),
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: { cpuVendorOverride: store.override },
    update: store.update,
    loading: false,
  }),
}));

import { useCpuVendor } from './use-cpu-vendor';

function cpu(vendor: CpuVendor): CpuInfo {
  return {
    model: 'Processador de teste',
    manufacturer: vendor === 'intel' ? 'GenuineIntel' : 'AuthenticAMD',
    vendor,
    cores: 8,
    logicalProcessors: 16,
    architecture: 'x64',
    usage: 10,
  };
}

beforeEach(() => {
  store.cpuState = { status: 'loading' };
  store.override = null;
  store.update.mockClear();
});

describe('useCpuVendor — detecção', () => {
  it('expõe o fabricante detectado e o usa como efetivo', () => {
    store.cpuState = { status: 'success', data: cpu('amd') };

    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.detected).toBe('amd');
    expect(result.current.effective).toBe('amd');
    expect(result.current.isManual).toBe(false);
  });

  it('devolve unknown enquanto a CPU carrega', () => {
    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.detected).toBe('unknown');
    expect(result.current.effective).toBe('unknown');
  });

  it('devolve unknown quando a leitura da CPU falha', () => {
    store.cpuState = { status: 'error', error: 'WMI indisponível' };

    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.detected).toBe('unknown');
    expect(result.current.effective).toBe('unknown');
  });

  it('lista as categorias da página Desempenho', () => {
    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.categories).toEqual(['CPU', 'GPU', 'Windows']);
  });
});

describe('useCpuVendor — override', () => {
  it('usa o override quando a detecção é desconhecida e sinaliza modo manual', () => {
    store.cpuState = { status: 'success', data: cpu('unknown') };
    store.override = 'intel';

    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.detected).toBe('unknown');
    expect(result.current.effective).toBe('intel');
    expect(result.current.isManual).toBe(true);
  });

  it('a detecção vence o override, mesmo contradizendo', () => {
    store.cpuState = { status: 'success', data: cpu('amd') };
    store.override = 'intel';

    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.detected).toBe('amd');
    expect(result.current.effective).toBe('amd');
    expect(result.current.isManual).toBe(false);
  });

  it('sem override e sem detecção, continua unknown e não manual', () => {
    store.cpuState = { status: 'success', data: cpu('unknown') };

    const { result } = renderHook(() => useCpuVendor());

    expect(result.current.effective).toBe('unknown');
    expect(result.current.isManual).toBe(false);
  });

  it('grava o override escolhido', () => {
    const { result } = renderHook(() => useCpuVendor());

    act(() => result.current.setOverride('intel'));

    expect(store.update).toHaveBeenCalledTimes(1);
    expect(store.update).toHaveBeenCalledWith({ cpuVendorOverride: 'intel' });
  });

  it('converter unknown em null ao gravar', () => {
    const { result } = renderHook(() => useCpuVendor());

    act(() => result.current.setOverride('unknown'));

    expect(store.update).toHaveBeenCalledWith({ cpuVendorOverride: null });
  });

  it('limpa o override', () => {
    store.override = 'amd';
    const { result } = renderHook(() => useCpuVendor());

    act(() => result.current.clearOverride());

    expect(store.update).toHaveBeenCalledWith({ cpuVendorOverride: null });
  });
});
