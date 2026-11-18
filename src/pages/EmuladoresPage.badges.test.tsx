// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../contexts/EmulatorContext', () => ({
  useEmulatorContext: () => store.emulator,
  EmulatorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => store.settings,
}));

import EmuladoresPage from './EmuladoresPage';
import { AppListView } from './EmuladoresPage/AppListView';

const store: {
  emulator: Record<string, unknown>;
  settings: Record<string, unknown>;
} = {
  emulator: {},
  settings: {},
};

function setStore(emulatorAtivo: string | null) {
  store.emulator = {
    emulatorAtivo,
    instanciaSelecionada: null,
    deviceSerial: null,
    setEmulatorAtivo: vi.fn(),
    setInstanciaSelecionada: vi.fn(),
    setDeviceSerial: vi.fn(),
    setListaApps: vi.fn(),
    setCarregando: vi.fn(),
    setInstancesLoading: vi.fn(),
    setConnecting: vi.fn(),
    setAdbPath: vi.fn(),
    setAdbError: vi.fn(),
    setDetectedVersions: vi.fn(),
    listaApps: [],
    appsSelecionados: new Set<string>(),
    carregando: false,
    toggleAppSelection: vi.fn(),
    clearSelection: vi.fn(),
    setAppsSelecionados: vi.fn(),
  };
  store.settings = {
    settings: { adbPath: null, soundEnabled: false },
    update: vi.fn(),
  };
}

beforeEach(() => {
  (window as unknown as { electronAPI?: unknown }).electronAPI = {
    adbGetPath: vi.fn(async () => null),
    adbDetectEmulator: vi.fn(async () => ({ installed: false, version: null })),
  };
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  vi.restoreAllMocks();
});

describe('EmuladoresPage — badge de conectado', () => {
  it.each(['bluestacks-4', 'bluestacks-5'])(
    'não sobrescreve o foreground do primary com cor fixa em %s',
    (emulatorAtivo) => {
      setStore(emulatorAtivo);
      render(<EmuladoresPage />);

      const badge = screen.getByText('Conectado');
      expect(badge.className).not.toContain('text-blue-400');
      expect(badge.className).not.toContain('text-emerald-400');
      expect(badge.className).toContain('text-[10px]');
      expect(badge.getAttribute('style')).toContain('var(--color-primary)');
    }
  );

  it('não usa sombra RGB fixa nos cartões ativos', () => {
    setStore('bluestacks-4');
    const { container } = render(<EmuladoresPage />);

    expect(container.innerHTML).not.toContain('rgba(59,130,246');
    expect(container.innerHTML).not.toContain('rgba(16,185,129');
  });
});

describe('AppListView — menu de presets', () => {
  it('filhos do botão herdam a cor do hover em vez de fixar muted-foreground', () => {
    setStore(null);
    render(
      <AppListView
        emulatorName="BlueStacks 5"
        instance={{ id: 'i1', name: 'instancia', arch: 'arm64' }}
        deviceSerial="serial-1"
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));

    const hint = screen.getByText('Todos os apps conhecidos');
    expect(hint.className).not.toContain('text-muted-foreground');
    expect(hint.closest('button')?.className).toContain('hover:text-accent-foreground');
  });
});
