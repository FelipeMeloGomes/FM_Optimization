// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, DashboardData, StorageDrive } from '../../../electron/shared/ipc-types';

const hook = vi.hoisted(() => ({
  state: { status: 'success', data: { drives: [] } } as unknown as AsyncState<DashboardData>,
  drives: [] as StorageDrive[],
  selected: new Set<string>(),
  optimizeFlags: new Set<string>(),
  busy: new Set<string>(),
  errors: {} as Record<string, string>,
  applied: {} as Record<string, boolean>,
  refresh: vi.fn(),
  toggleSelected: vi.fn(),
  toggleOptimize: vi.fn(),
  cleanup: vi.fn<(letter: string) => Promise<void>>(),
  optimize: vi.fn<(letter: string) => Promise<void>>(),
  cleanupSelected: vi.fn<() => Promise<void>>(),
}));

vi.mock('../../hooks/use-storage-drives', () => ({
  useStorageDrives: () => hook,
}));

import { StorageSettingsPanel } from './StorageSettingsPanel';

const SSD: StorageDrive = {
  letter: 'C:',
  label: 'Sistema',
  size: '512 GB',
  free: '200 GB',
  usedPercent: 61,
  type: 'SSD NVMe',
};
const HD: StorageDrive = {
  letter: 'D:',
  label: 'Dados',
  size: '1 TB',
  free: '244 GB',
  usedPercent: 78,
  type: 'HD',
};

beforeEach(() => {
  hook.state = {
    status: 'success',
    data: { drives: [SSD, HD] } as unknown as DashboardData,
  };
  hook.drives = [SSD, HD];
  hook.selected = new Set();
  hook.optimizeFlags = new Set();
  hook.busy = new Set();
  hook.errors = {};
  hook.applied = {};
  for (const fn of [
    hook.refresh,
    hook.toggleSelected,
    hook.toggleOptimize,
    hook.cleanup,
    hook.optimize,
    hook.cleanupSelected,
  ]) {
    fn.mockReset();
  }
});

describe('StorageSettingsPanel', () => {
  it('mostra um card por disco com tipo, capacidade total e espaço livre', () => {
    render(<StorageSettingsPanel />);
    expect(screen.getAllByText('Disco C:')).toHaveLength(1);
    expect(screen.getAllByText('Disco D:')).toHaveLength(1);
    expect(screen.getByText('SSD NVMe')).toBeDefined();
    expect(screen.getByText('HD')).toBeDefined();
    expect(screen.getByText('512 GB')).toBeDefined();
    expect(screen.getByText('200 GB livres')).toBeDefined();
    expect(screen.getByText('1 TB')).toBeDefined();
    expect(screen.getByText('244 GB livres')).toBeDefined();
  });

  it('esconde otimização e o botão Otimizar SSD no HD', () => {
    render(<StorageSettingsPanel />);
    expect(screen.getAllByRole('checkbox', { name: 'Incluir otimização SSD (TRIM)' })).toHaveLength(
      1
    );
    expect(screen.getAllByRole('button', { name: 'Otimizar SSD' })).toHaveLength(1);
  });

  it('chama as ações do hook com a letra do card', () => {
    render(<StorageSettingsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpeza de disco' })[1]);
    expect(hook.cleanup).toHaveBeenCalledWith('D:');
    fireEvent.click(screen.getByRole('button', { name: 'Otimizar SSD' }));
    expect(hook.optimize).toHaveBeenCalledWith('C:');
  });

  it('chama o hook ao selecionar e só habilita o lote com seleção', () => {
    const { rerender } = render(<StorageSettingsPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Disco C:' }));
    expect(hook.toggleSelected).toHaveBeenCalledWith('C:');

    const bulk = screen.getByRole('button', { name: 'Executar limpeza nos selecionados' });
    expect((bulk as HTMLButtonElement).disabled).toBe(true);
    hook.selected = new Set(['C:']);
    rerender(<StorageSettingsPanel />);
    expect((bulk as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(bulk);
    expect(hook.cleanupSelected).toHaveBeenCalledTimes(1);
  });

  it('mostra esqueleto, erro com retry e estado vazio', () => {
    hook.state = { status: 'loading' };
    const { rerender } = render(<StorageSettingsPanel />);
    expect(document.querySelector('.animate-pulse')).not.toBeNull();

    hook.state = { status: 'error', error: 'WMI indisponível' };
    rerender(<StorageSettingsPanel />);
    expect(screen.getByText('WMI indisponível')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(hook.refresh).toHaveBeenCalled();

    hook.state = { status: 'success', data: { drives: [] } as unknown as DashboardData };
    hook.drives = [];
    rerender(<StorageSettingsPanel />);
    expect(screen.getByText('Nenhuma unidade encontrada')).toBeDefined();
  });
});
