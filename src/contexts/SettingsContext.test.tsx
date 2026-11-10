// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../electron/shared/ipc-types';

// O tema importa o BatmanBackground, que instancia `Path2D` no topo do módulo;
// nem o jsdom implementa canvas. O fundo não influencia as configurações.
vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import { SettingsProvider, useSettingsContext } from './SettingsContext';

const SAVED: AppSettings = {
  theme: 'amber',
  accentColor: '#ff8800',
  confirmOnExecute: false,
  autoRestorePoint: false,
  cpuVendorOverride: 'intel',
  security: {
    enableIpcValidation: true,
    enableDenyListBlock: true,
    enablePathValidation: true,
    enablePsSanitize: true,
  },
  pageLock: {
    enabled: true,
    salt: 's',
    passwordHashCipher: 'h',
    lockedPages: ['/cpu'],
    unlocked: false,
  },
  soundEnabled: false,
  toastDuration: 'long',
  adbPath: 'C:/adb.exe',
  autoClean: {
    enabled: true,
    cleaners: ['cleaner-1'],
    frequency: 'daily',
    weekday: null,
    dayOfMonth: null,
    time: '04:30',
    runOnStartup: true,
    catchUp: false,
    lastRunAt: 1,
    nextRunAt: 2,
    pending: [],
  },
};

function installApi(overrides: Partial<Record<string, unknown>> = {}) {
  const api = {
    getSettings: vi.fn(async () => SAVED),
    saveSettings: vi.fn(async () => undefined),
    exportData: vi.fn(async () => ({})),
    importData: vi.fn(async () => undefined),
    ...overrides,
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

function Probe() {
  const { settings, update, loading } = useSettingsContext();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="theme">{settings.theme}</span>
      <span data-testid="confirm">{String(settings.confirmOnExecute)}</span>
      <span data-testid="vendor">{String(settings.cpuVendorOverride)}</span>
      <button type="button" onClick={() => update({ confirmOnExecute: true })}>
        confirmar
      </button>
      <button type="button" onClick={() => update({ theme: 'batman' })}>
        trocar tema
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>
  );
}

beforeEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('SettingsProvider', () => {
  it('carrega as configurações salvas e encerra o loading', async () => {
    installApi();
    renderProvider();

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('amber');
    expect(screen.getByTestId('confirm').textContent).toBe('false');
    expect(screen.getByTestId('vendor').textContent).toBe('intel');
  });

  it('mantém os padrões quando a leitura falha e sai do loading', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    installApi({ getSettings: vi.fn(async () => Promise.reject(new Error('boom'))) });
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('persiste o objeto completo ao atualizar uma única chave', async () => {
    const api = installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    act(() => screen.getByRole('button', { name: 'confirmar' }).click());

    expect(screen.getByTestId('confirm').textContent).toBe('true');
    expect(api.saveSettings).toHaveBeenCalledTimes(1);
    expect(api.saveSettings).toHaveBeenCalledWith({ ...SAVED, confirmOnExecute: true });
  });

  it('acumula atualizações sem perder a anterior', async () => {
    installApi();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    act(() => screen.getByRole('button', { name: 'confirmar' }).click());
    act(() => screen.getByRole('button', { name: 'trocar tema' }).click());

    expect(screen.getByTestId('confirm').textContent).toBe('true');
    expect(screen.getByTestId('theme').textContent).toBe('batman');
  });
});

describe('SettingsProvider — tema e cor de destaque', () => {
  it('aplica a classe do tema escuro no elemento raiz', async () => {
    installApi();
    renderProvider();

    await waitFor(() => expect(document.documentElement.classList.contains('amber')).toBe(true));
  });

  it('remove a classe escura anterior ao trocar para um tema claro', async () => {
    document.documentElement.classList.add('amber');
    installApi({ getSettings: vi.fn(async () => ({ ...SAVED, theme: 'light' })) });
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('light'));
    expect(document.documentElement.classList.contains('amber')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('deriva a paleta do accent a partir do hex', async () => {
    installApi({ getSettings: vi.fn(async () => ({ ...SAVED, accentColor: '#ff0000' })) });
    renderProvider();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--accent-h')).toBe('0')
    );
    expect(document.documentElement.style.getPropertyValue('--accent-s')).toBe('100%');
    expect(document.documentElement.style.getPropertyValue('--accent-500')).toBe(
      'hsl(0, 100%, 50%)'
    );
    expect(document.documentElement.style.getPropertyValue('--color-primary-foreground')).toBe(
      '#ffffff'
    );
  });

  it('usa texto escuro sobre accent claro', async () => {
    installApi({ getSettings: vi.fn(async () => ({ ...SAVED, accentColor: '#aabbcc' })) });
    renderProvider();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--accent-l')).toBe('73%')
    );
    expect(document.documentElement.style.getPropertyValue('--color-primary-foreground')).toBe(
      '#0a0b10'
    );
  });
});

describe('useSettingsContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useSettingsContext must be used within SettingsProvider'
    );

    consoleError.mockRestore();
  });
});
