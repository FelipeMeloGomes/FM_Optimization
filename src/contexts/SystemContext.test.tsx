// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CpuInfo, DashboardData, MemoryInfo } from '../../electron/shared/ipc-types';

import {
  CpuProvider,
  MemoryProvider,
  SystemProvider,
  useCpuContext,
  useMemoryContext,
  useSystemContext,
} from './SystemContext';

const CPU: CpuInfo = {
  model: 'AMD Ryzen 7 5700X',
  manufacturer: 'AuthenticAMD',
  vendor: 'amd',
  cores: 8,
  logicalProcessors: 16,
  architecture: 'x64',
  usage: 12,
};

const CPU_NOVO: CpuInfo = { ...CPU, model: 'AMD Ryzen 9 7900X', usage: 42 };

const MEMORY: MemoryInfo = {
  total: '32 GB',
  used: '12 GB',
  free: '20 GB',
  type: 'DDR4',
  slots: 2,
  frequency: '3200 MHz',
};

const DASHBOARD: DashboardData = {
  cpu: CPU,
  gpu: { name: 'AMD Radeon RX 7600', vram: '8 GB', driverVersion: '32.0.1', usage: 4 },
  memory: MEMORY,
  os: {
    name: 'Windows 11 Pro',
    version: '10.0.26100',
    build: '26100',
    edition: 'Pro',
    installDate: '2025-01-01',
  },
  drives: [],
  uptime: 1000,
};

function installApi() {
  const api = {
    getCpuInfo: vi.fn<() => Promise<CpuInfo>>(async () => CPU),
    getMemoryInfo: vi.fn<() => Promise<MemoryInfo>>(async () => MEMORY),
    getSystemInfo: vi.fn<() => Promise<DashboardData>>(async () => DASHBOARD),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function CpuProbe() {
  const { state, refreshing, refresh } = useCpuContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="model">{state.status === 'success' ? state.data.model : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <button type="button" onClick={refresh}>
        atualizar cpu
      </button>
    </div>
  );
}

function MemoryProbe() {
  const { state, refreshing, refresh } = useMemoryContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="total">{state.status === 'success' ? state.data.total : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <button type="button" onClick={refresh}>
        atualizar memória
      </button>
    </div>
  );
}

function SystemProbe() {
  const { state, refreshing, refresh } = useSystemContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="uptime">
        {state.status === 'success' ? String(state.data.uptime) : ''}
      </span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <button type="button" onClick={refresh}>
        atualizar sistema
      </button>
    </div>
  );
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('CpuProvider', () => {
  it('começa em loading e publica os dados da CPU', async () => {
    installApi();
    render(
      <CpuProvider>
        <CpuProbe />
      </CpuProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('model').textContent).toBe('AMD Ryzen 7 5700X');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });

  it('expõe a mensagem quando a leitura falha', async () => {
    const api = installApi();
    api.getCpuInfo.mockRejectedValue(new Error('cpu indisponível'));
    render(
      <CpuProvider>
        <CpuProbe />
      </CpuProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('cpu indisponível');
  });

  it('usa o texto do erro quando a rejeição é uma string', async () => {
    const api = installApi();
    api.getCpuInfo.mockRejectedValue('falha crua');
    render(
      <CpuProvider>
        <CpuProbe />
      </CpuProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('falha crua');
  });

  it('marca refreshing durante o refresh e troca os dados ao concluir', async () => {
    const api = installApi();
    render(
      <CpuProvider>
        <CpuProbe />
      </CpuProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    await waitFor(() => expect(screen.getByTestId('refreshing').textContent).toBe('false'));

    const pending = deferred<CpuInfo>();
    api.getCpuInfo.mockImplementation(() => pending.promise);

    act(() => screen.getByRole('button', { name: 'atualizar cpu' }).click());
    expect(screen.getByTestId('refreshing').textContent).toBe('true');
    expect(screen.getByTestId('model').textContent).toBe('AMD Ryzen 7 5700X');

    await act(async () => {
      pending.resolve(CPU_NOVO);
      await pending.promise;
    });

    await waitFor(() => expect(screen.getByTestId('model').textContent).toBe('AMD Ryzen 9 7900X'));
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });
});

describe('MemoryProvider', () => {
  it('publica a memória lida', async () => {
    installApi();
    render(
      <MemoryProvider>
        <MemoryProbe />
      </MemoryProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('total').textContent).toBe('32 GB');
  });

  it('mantém o estado de erro sem dados', async () => {
    const api = installApi();
    api.getMemoryInfo.mockRejectedValue(new Error('sem memória'));
    render(
      <MemoryProvider>
        <MemoryProbe />
      </MemoryProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('sem memória');
    expect(screen.getByTestId('total').textContent).toBe('');
  });

  it('recarrega ao acionar refresh', async () => {
    const api = installApi();
    render(
      <MemoryProvider>
        <MemoryProbe />
      </MemoryProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const antes = api.getMemoryInfo.mock.calls.length;
    api.getMemoryInfo.mockResolvedValue({ ...MEMORY, total: '64 GB' });

    await act(async () => screen.getByRole('button', { name: 'atualizar memória' }).click());

    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('64 GB'));
    expect(api.getMemoryInfo.mock.calls.length).toBe(antes + 1);
  });
});

describe('SystemProvider', () => {
  it('carrega o dashboard agregado', async () => {
    installApi();
    render(
      <SystemProvider>
        <SystemProbe />
      </SystemProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('uptime').textContent).toBe('1000');
  });

  it('expõe erro do dashboard', async () => {
    const api = installApi();
    api.getSystemInfo.mockRejectedValue(new Error('dashboard quebrado'));
    render(
      <SystemProvider>
        <SystemProbe />
      </SystemProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('dashboard quebrado');
  });

  it('refaz a leitura quando refresh é chamado', async () => {
    const api = installApi();
    render(
      <SystemProvider>
        <SystemProbe />
      </SystemProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const antes = api.getSystemInfo.mock.calls.length;
    api.getSystemInfo.mockResolvedValue({ ...DASHBOARD, uptime: 2000 });

    await act(async () => screen.getByRole('button', { name: 'atualizar sistema' }).click());

    await waitFor(() => expect(screen.getByTestId('uptime').textContent).toBe('2000'));
    expect(api.getSystemInfo.mock.calls.length).toBe(antes + 1);
  });
});

describe('hooks de sistema fora do provider', () => {
  it('useCpuContext exige o CpuProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<CpuProbe />)).toThrow('useCpuContext must be used within its Provider');

    consoleError.mockRestore();
  });

  it('useMemoryContext exige o MemoryProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<MemoryProbe />)).toThrow(
      'useMemoryContext must be used within its Provider'
    );

    consoleError.mockRestore();
  });

  it('useSystemContext exige o SystemProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<SystemProbe />)).toThrow(
      'useSystemContext must be used within SystemProvider'
    );

    consoleError.mockRestore();
  });
});
