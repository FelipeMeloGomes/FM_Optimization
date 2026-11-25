// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  DashboardData,
  ExecutionHistoryEntry,
  ScriptEntry,
} from '../../electron/shared/ipc-types';

const store = vi.hoisted(() => ({
  system: { status: 'loading' } as AsyncState<DashboardData>,
  scripts: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  history: { status: 'loading' } as AsyncState<ExecutionHistoryEntry[]>,
  execute: vi.fn(async (_id: string) => {}),
}));

vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({
    state: store.system,
    refreshing: false,
    refresh: () => {},
    hasFetched: true,
    isFromCache: false,
  }),
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({ state: store.scripts }),
}));

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: store.history }),
}));

vi.mock('../contexts/ScriptExecutionContext', () => ({
  useScriptExecutionContext: () => ({
    activeExecution: null,
    execute: store.execute,
    cancel: vi.fn(),
  }),
}));

import MeuPcPage from './MeuPcPage';

const dashboard: DashboardData = {
  cpu: {
    model: 'AMD Ryzen 7 9800X3D',
    manufacturer: 'AMD',
    vendor: 'amd',
    cores: 8,
    logicalProcessors: 16,
    architecture: 'x64',
    usage: 12,
  },
  gpu: { name: 'NVIDIA GeForce RTX 5090', vram: '32 GB', driverVersion: '1.0', usage: 4 },
  memory: {
    total: '32 GB',
    used: '12 GB',
    free: '20 GB',
    type: 'DDR5',
    frequency: '6000 MHz',
    slots: 2,
    slotsUsed: 2,
    slotsTotal: 4,
  },
  motherboard: {
    manufacturer: 'Gigabyte Technology Co., Ltd.',
    product: 'X870 AORUS ELITE WIFI7',
    version: '1.0',
  },
  caches: { l1: '640 KB', l2: '8 MB', l3: '32 MB' },
  os: {
    name: 'Windows 11 Pro',
    version: '10.0.26100',
    build: '26100',
    edition: 'Pro',
    installDate: '2025-01-01',
  },
  drives: [
    {
      letter: 'C:',
      label: 'Sistema',
      size: '1 TB',
      free: '400 GB',
      usedPercent: 60,
      type: 'SSD NVMe',
      fileSystem: 'NTFS',
    },
  ],
  uptime: 90061,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.system = { status: 'success', data: dashboard };
  store.scripts = { status: 'success', data: [] };
  store.history = { status: 'success', data: [] };
});

describe('MeuPcPage', () => {
  it('mostra os três grupos de cards no esqueleto, com sete itens no último', () => {
    store.system = { status: 'loading' };

    const { container } = render(<MeuPcPage />);
    const grids = container.querySelectorAll('[data-skeleton="grid"]');

    expect(grids).toHaveLength(3);
    expect(grids[2].children.length).toBe(7);
  });

  it('mostra o título e a descrição lida do Windows', () => {
    render(<MeuPcPage />);

    expect(screen.getByText('Meu PC')).toBeTruthy();
    expect(screen.getByText(/lido direto do Windows/i)).toBeTruthy();
  });

  it('lista os sete itens do sistema sem Check-up', () => {
    render(<MeuPcPage />);

    const itens = within(screen.getByTestId('itens-do-sistema'));
    for (const label of [
      'Processador',
      'Caches',
      'Placa-mãe',
      'Memória',
      'Slots de memória',
      'Gráficos',
      'Armazenamento',
    ]) {
      expect(itens.getByText(label)).toBeTruthy();
    }
    expect(itens.queryByText('Check-up')).toBeNull();
  });

  it('exporta o relatório usando o script Relatorios do Sistema', () => {
    render(<MeuPcPage />);

    fireEvent.click(screen.getByRole('button', { name: /exportar relatório/i }));

    expect(store.execute).toHaveBeenCalledWith('util-3');
  });
});
