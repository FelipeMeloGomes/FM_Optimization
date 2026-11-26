// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({
  emulator: {} as Record<string, unknown>,
}));

vi.mock('../../contexts/EmulatorContext', () => ({
  useEmulatorContext: () => ctx.emulator,
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { adbPath: null } }),
}));

import { AppListView } from './AppListView';

describe('AppListView — carregamento', () => {
  beforeEach(() => {
    ctx.emulator = {
      listaApps: [],
      appsSelecionados: new Set<string>(),
      carregando: true,
      toggleAppSelection: vi.fn(),
      clearSelection: vi.fn(),
      setListaApps: vi.fn(),
      setAppsSelecionados: vi.fn(),
      setCarregando: vi.fn(),
    };
  });

  it('mostra cards de apps no lugar do spinner central', () => {
    const { container } = render(
      <AppListView
        emulatorName="BlueStacks 5"
        instance={{ id: 'instancia', name: 'Instância' } as never}
        deviceSerial="serial"
        onBack={() => {}}
      />
    );

    expect(screen.getByRole('status', { name: 'Carregando apps…' })).toBeTruthy();
    expect(container.querySelectorAll('[data-skeleton="card"]')).toHaveLength(6);
    expect(container.querySelector('[data-skeleton="grid"]')).not.toBeNull();
  });

  it('mantém a busca como caixa de texto, sem o clear button nativo de search', () => {
    render(
      <AppListView
        emulatorName="BlueStacks 5"
        instance={{ id: 'instancia', name: 'Instância' } as never}
        deviceSerial="serial"
        onBack={() => {}}
      />
    );

    expect(screen.getByRole('textbox', { name: 'Buscar apps' })).toBeTruthy();
    expect(screen.queryByRole('searchbox', { name: 'Buscar apps' })).toBeNull();
  });
});
