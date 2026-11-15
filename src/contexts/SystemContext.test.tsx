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
    getSystemInfoCache: vi.fn<() => Promise<null>>(async () => null),
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
  const { state, refreshing, refresh, hasFetched } = useCpuContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="model">{state.status === 'success' ? state.data.model : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <span data-testid="has-fetched">{String(hasFetched)}</span>
      <button type="button" onClick={refresh}>
        atualizar cpu
      </button>
    </div>
  );
}

function MemoryProbe() {
  const { state, refreshing, refresh, hasFetched } = useMemoryContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="total">{state.status === 'success' ? state.data.total : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <span data-testid="has-fetched">{String(hasFetched)}</span>
      <button type="button" onClick={refresh}>
        atualizar memória
      </button>
    </div>
  );
}

function SystemProbe() {
  const { state, refreshing, refresh, hasFetched } = useSystemContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="uptime">
        {state.status === 'success' ? String(state.data.uptime) : ''}
      </span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <span data-testid="has-fetched">{String(hasFetched)}</span>
      <button type="button" onClick={refresh}>
        atualizar dashboard
      </button>
    </div>
  );
}

function wrapCpu(ui: React.ReactElement) {
  return render(<CpuProvider>{ui}</CpuProvider>);
}

function wrapMemory(ui: React.ReactElement) {
  return render(<MemoryProvider>{ui}</MemoryProvider>);
}

function wrapSystem(ui: React.ReactElement) {
  return render(<SystemProvider>{ui}</SystemProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CpuProvider', () => {
  it('começa em loading e NÃO busca até refresh ser chamado', async () => {
    installApi();
    wrapCpu(<CpuProbe />);

    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(screen.getByTestId('has-fetched').textContent).toBe('false');

    // Chama refresh para disparar a busca
    await act(async () => {
      screen.getByRole('button', { name: /atualizar cpu/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('model').textContent).toBe('AMD Ryzen 7 5700X');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });

  it('expõe a mensagem quando a leitura falha', async () => {
    const api = installApi();
    api.getCpuInfo.mockRejectedValueOnce('cpu indisponível');
    wrapCpu(<CpuProbe />);

    // Chama refresh para disparar a busca
    await act(async () => {
      screen.getByRole('button', { name: /atualizar cpu/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('cpu indisponível');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
  });

  it('usa o texto do erro quando a rejeição é uma string', async () => {
    const api = installApi();
    api.getCpuInfo.mockRejectedValueOnce('falha crua');
    wrapCpu(<CpuProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar cpu/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('falha crua');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
  });

  it('marca refreshing durante o refresh e troca os dados ao concluir', async () => {
    const api = installApi();
    const { promise, resolve } = deferred<CpuInfo>();
    api.getCpuInfo.mockReturnValueOnce(promise);

    wrapCpu(<CpuProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar cpu/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('refreshing').textContent).toBe('true'));
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');

    await act(async () => {
      resolve(CPU_NOVO);
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('model').textContent).toBe('AMD Ryzen 9 7900X');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });
});

describe('MemoryProvider', () => {
  it('publica a memória lida', async () => {
    installApi();
    wrapMemory(<MemoryProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar memória/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('total').textContent).toBe('32 GB');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });

  it('mantém o estado de erro sem dados', async () => {
    const api = installApi();
    api.getMemoryInfo.mockRejectedValueOnce('sem memória');
    wrapMemory(<MemoryProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar memória/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('sem memória');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
    expect(screen.getByTestId('total').textContent).toBe('');
  });

  it('recarrega ao acionar refresh', async () => {
    const api = installApi();
    wrapMemory(<MemoryProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar memória/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('32 GB'));
    const antes = api.getMemoryInfo.mock.calls.length;

    const MEMORY_NOVA: MemoryInfo = { ...MEMORY, total: '64 GB' };
    api.getMemoryInfo.mockResolvedValueOnce(MEMORY_NOVA);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar memória/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('64 GB'));
    expect(api.getMemoryInfo.mock.calls.length).toBe(antes + 1);
  });
});

describe('SystemProvider', () => {
  it('carrega o dashboard agregado', async () => {
    installApi();
    wrapSystem(<SystemProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('uptime').textContent).toBe('1000');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
  });

  it('expõe erro do dashboard', async () => {
    const api = installApi();
    api.getSystemInfo.mockRejectedValueOnce('dashboard quebrado');
    wrapSystem(<SystemProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('dashboard quebrado');
    expect(screen.getByTestId('has-fetched').textContent).toBe('true');
  });

  it('refaz a leitura quando refresh é chamado', async () => {
    const api = installApi();
    wrapSystem(<SystemProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('uptime').textContent).toBe('1000'));
    const antes = api.getSystemInfo.mock.calls.length;

    api.getSystemInfo.mockResolvedValueOnce({ ...DASHBOARD, uptime: 2000 });

    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('uptime').textContent).toBe('2000'));
    expect(api.getSystemInfo.mock.calls.length).toBe(antes + 1);
  });

  it('permite refresh manual múltiplas vezes', async () => {
    const api = installApi();
    wrapSystem(<SystemProbe />);

    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(api.getSystemInfo.mock.calls.length).toBe(1);

    // Segundo refresh manual deve disparar nova busca
    await act(async () => {
      screen.getByRole('button', { name: /atualizar dashboard/i }).click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(api.getSystemInfo.mock.calls.length).toBe(2);
  });
});

describe('useCpuContext', () => {
  it('exige o CpuProvider', () => {
    expect(() => render(<CpuProbe />)).toThrow('useCpuContext must be used within its Provider');
  });
});

describe('useMemoryContext', () => {
  it('exige o MemoryProvider', () => {
    expect(() => render(<MemoryProbe />)).toThrow(
      'useMemoryContext must be used within its Provider'
    );
  });
});

describe('useSystemContext', () => {
  it('exige o SystemProvider', () => {
    expect(() => render(<SystemProbe />)).toThrow(
      'useSystemContext must be used within SystemProvider'
    );
  });
});
