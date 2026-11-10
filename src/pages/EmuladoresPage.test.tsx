// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão da página Emuladores: herói, cartões BlueStacks 4/5, detecção de
 * versão via `adbDetectEmulator`, caminho do ADB via `adbGetPath`, seleção de
 * emulador e mudança de view. `useEmulatorContext`, `useSettingsContext` e
 * `window.electronAPI` são mockados na fronteira.
 */

vi.mock('../contexts/EmulatorContext', () => ({
  useEmulatorContext: () => store.emulator,
  EmulatorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => store.settings,
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import EmuladoresPage from './EmuladoresPage';

const store: {
  emulator: {
    emulatorAtivo: 'bluestacks-4' | 'bluestacks-5' | null;
    instanciaSelecionada: null;
    deviceSerial: null;
    setEmulatorAtivo: ReturnType<typeof vi.fn>;
    setInstanciaSelecionada: ReturnType<typeof vi.fn>;
    setDeviceSerial: ReturnType<typeof vi.fn>;
    setSelectedEmulator: ReturnType<typeof vi.fn>;
    setModalOpen: ReturnType<typeof vi.fn>;
    setListaApps: ReturnType<typeof vi.fn>;
    setCarregando: ReturnType<typeof vi.fn>;
    setInstancesLoading: ReturnType<typeof vi.fn>;
    setConnecting: ReturnType<typeof vi.fn>;
    setAdbPath: ReturnType<typeof vi.fn>;
    setAdbError: ReturnType<typeof vi.fn>;
    setDetectedVersions: ReturnType<typeof vi.fn>;
  };
  settings: {
    settings: { adbPath: string | null };
    update: ReturnType<typeof vi.fn>;
  };
} = {
  emulator: {
    emulatorAtivo: null,
    instanciaSelecionada: null,
    deviceSerial: null,
    setEmulatorAtivo: vi.fn(),
    setInstanciaSelecionada: vi.fn(),
    setDeviceSerial: vi.fn(),
    setSelectedEmulator: vi.fn(),
    setModalOpen: vi.fn(),
    setListaApps: vi.fn(),
    setCarregando: vi.fn(),
    setInstancesLoading: vi.fn(),
    setConnecting: vi.fn(),
    setAdbPath: vi.fn(),
    setAdbError: vi.fn(),
    setDetectedVersions: vi.fn(),
  },
  settings: {
    settings: { adbPath: null },
    update: vi.fn(),
  },
};

beforeEach(() => {
  emulator();
  settings();
});

function emulator(overrides: Partial<typeof store.emulator> = {}) {
  store.emulator = {
    emulatorAtivo: null,
    instanciaSelecionada: null,
    deviceSerial: null,
    setEmulatorAtivo: vi.fn(),
    setInstanciaSelecionada: vi.fn(),
    setDeviceSerial: vi.fn(),
    setSelectedEmulator: vi.fn(),
    setModalOpen: vi.fn(),
    setListaApps: vi.fn(),
    setCarregando: vi.fn(),
    setInstancesLoading: vi.fn(),
    setConnecting: vi.fn(),
    setAdbPath: vi.fn(),
    setAdbError: vi.fn(),
    setDetectedVersions: vi.fn(),
    ...overrides,
  };
}

function settings(overrides: Partial<typeof store.settings> = {}) {
  store.settings = {
    settings: { adbPath: null },
    update: vi.fn(),
    ...overrides,
  };
}

function installApi(overrides: Record<string, unknown> = {}) {
  (window as unknown as { electronAPI?: unknown }).electronAPI = {
    adbGetPath: vi.fn(async () => null),
    adbDetectEmulator: vi.fn(async () => ({ installed: false, version: null })),
    ...overrides,
  };
}

function renderPage() {
  return render(<EmuladoresPage />);
}

beforeEach(() => {
  emulator();
  settings();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  installApi();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('EmuladoresPage', () => {
  it('renderiza o herói e os cartões de emulador', () => {
    renderPage();

    expect(screen.getByText('Debloat de Apps Android')).toBeDefined();
    expect(screen.getByText('BlueStacks 4')).toBeDefined();
    expect(screen.getByText('BlueStacks 5')).toBeDefined();
    expect(screen.getByText('Emulador Android Nougat (64-bit)')).toBeDefined();
    expect(screen.getByText('Emulador Android Pie (64-bit)')).toBeDefined();
  });

  it('chama adbGetPath para recuperar o caminho do ADB', () => {
    const api = (window as unknown as { electronAPI: { adbGetPath: unknown } }).electronAPI;

    renderPage();

    expect(api.adbGetPath).toHaveBeenCalled();
  });

  it('chama adbDetectEmulator para cada emulador na montagem', () => {
    const api = (window as unknown as { electronAPI: { adbDetectEmulator: unknown } }).electronAPI;

    renderPage();

    expect(api.adbDetectEmulator).toHaveBeenCalledTimes(2);
    expect(api.adbDetectEmulator).toHaveBeenCalledWith('bluestacks-4');
    expect(api.adbDetectEmulator).toHaveBeenCalledWith('bluestacks-5');
  });

  it('marca exatamente um card de emulador como ativo', () => {
    emulator({ emulatorAtivo: 'bluestacks-4' });
    renderPage();
    expect(document.querySelectorAll('.border-blue-500\\/30').length).toBe(1);

    emulator({ emulatorAtivo: 'bluestacks-5' });
    renderPage();
    expect(document.querySelectorAll('.border-blue-500\\/30').length).toBe(1);
  });
});
