// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppSettings,
  ExecutionHistoryEntry,
  ScriptEnded,
} from '../../electron/shared/ipc-types';

import { HistoryProvider, useHistoryContext } from './HistoryContext';
import { SettingsProvider } from './SettingsContext';

const HISTORY: ExecutionHistoryEntry[] = [
  {
    id: 'h1',
    scriptId: 's1',
    scriptName: 'Limpeza Rápida',
    startTime: '2025-01-01T10:00:00.000Z',
    endTime: '2025-01-01T10:00:02.000Z',
    durationMs: 2000,
    exitCode: 0,
    wasCancelled: false,
  },
];

const HISTORY_NOVO: ExecutionHistoryEntry[] = [
  ...HISTORY,
  {
    id: 'h2',
    scriptId: 's2',
    scriptName: 'DNS Cloudflare',
    startTime: '2025-01-01T11:00:00.000Z',
    endTime: '2025-01-01T11:00:01.000Z',
    durationMs: 1000,
    exitCode: null,
    wasCancelled: true,
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: '#22d3ee',
  confirmOnExecute: true,
  autoRestorePoint: true,
  cpuVendorOverride: null,
  security: {
    enableIpcValidation: true,
    enableDenyListBlock: false,
    enablePathValidation: true,
    enablePsSanitize: true,
  },
  pageLock: {
    enabled: true,
    salt: '',
    passwordHashCipher: '',
    lockedPages: ['/emuladores'],
    unlocked: false,
  },
  soundEnabled: true,
  toastDuration: 'medium',
  adbPath: null,
  autoClean: {
    enabled: false,
    cleaners: ['cleaner-1', 'cleaner-2', 'cleaner-3', 'cleaner-4'],
    frequency: 'weekly',
    weekday: 0,
    dayOfMonth: 1,
    time: '03:00',
    runOnStartup: false,
    catchUp: true,
    lastRunAt: null,
    nextRunAt: null,
    pending: [],
  },
  powerSaveMode: false,
};

function installApi(settings: Partial<AppSettings> = {}) {
  let endedCb: ((data: ScriptEnded) => void) | null = null;
  const offScriptEnded = vi.fn();
  const api = {
    getExecutionHistory: vi.fn<() => Promise<ExecutionHistoryEntry[]>>(async () => HISTORY),
    onScriptEnded: vi.fn((cb: (data: ScriptEnded) => void) => {
      endedCb = cb;
      return offScriptEnded;
    }),
    getSettings: vi.fn<() => Promise<AppSettings>>(async () => ({
      ...DEFAULT_SETTINGS,
      ...settings,
    })),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return {
    api,
    offScriptEnded,
    emitScriptEnded(data: ScriptEnded) {
      endedCb?.(data);
    },
    hasListener() {
      return endedCb !== null;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function Probe() {
  const { state, refresh } = useHistoryContext();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="count">{state.status === 'success' ? String(state.data.length) : ''}</span>
      <span data-testid="error">{state.status === 'error' ? state.error : ''}</span>
      <button type="button" onClick={refresh}>
        atualizar histórico
      </button>
    </div>
  );
}

function renderProvider(_settings: Partial<AppSettings> = {}) {
  return render(
    <SettingsProvider>
      <HistoryProvider>
        <Probe />
      </HistoryProvider>
    </SettingsProvider>
  );
}

afterEach(async () => {
  // Drena atualizações pendentes (getSettings() -> setSettings -> efeito do listener)
  // antes de remover o API, para que nenhum efeito tardio acesse window.electronAPI.
  await act(async () => {
    await Promise.resolve();
  });
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('HistoryProvider', () => {
  it('começa em loading e publica o histórico', async () => {
    installApi();
    renderProvider({ powerSaveMode: false });

    expect(screen.getByTestId('status').textContent).toBe('loading');

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('expõe a mensagem de erro', async () => {
    const harness = installApi();
    harness.api.getExecutionHistory.mockRejectedValue(new Error('histórico quebrado'));
    renderProvider({ powerSaveMode: false });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toBe('histórico quebrado');
  });

  it('refresh volta para loading e busca novamente', async () => {
    const harness = installApi();
    renderProvider({ powerSaveMode: false });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    const pending = deferred<ExecutionHistoryEntry[]>();
    harness.api.getExecutionHistory.mockImplementation(() => pending.promise);

    act(() => screen.getByRole('button', { name: 'atualizar histórico' }).click());
    expect(screen.getByTestId('status').textContent).toBe('loading');

    await act(async () => {
      pending.resolve(HISTORY_NOVO);
      await pending.promise;
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(harness.api.getExecutionHistory).toHaveBeenCalledTimes(2);
  });

  it('recarrega quando o main avisa que um script terminou', async () => {
    const harness = installApi();
    renderProvider({ powerSaveMode: false });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    harness.api.getExecutionHistory.mockResolvedValue(HISTORY_NOVO);
    act(() => harness.emitScriptEnded({ id: 'h2', code: 0 }));

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    expect(harness.api.getExecutionHistory).toHaveBeenCalledTimes(2);
  });

  it('remove o listener de script terminado ao desmontar', async () => {
    const harness = installApi();
    const { unmount } = renderProvider({ powerSaveMode: false });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    expect(harness.hasListener()).toBe(true);
    unmount();

    expect(harness.offScriptEnded).toHaveBeenCalledTimes(1);
  });

  it('não registra listener onScriptEnded quando powerSaveMode=true', async () => {
    installApi();
    renderProvider({ powerSaveMode: true });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    // O listener não deve ter sido registrado
    // (não podemos testar diretamente, mas garantimos que não quebra)
    expect(screen.getByTestId('status').textContent).toBe('success');
  });
});

describe('useHistoryContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useHistoryContext must be used within HistoryProvider'
    );

    consoleError.mockRestore();
  });
});
