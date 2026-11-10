// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppSettings,
  AutoCleanRunResult,
  AutoCleanSettings,
  AutoCleanStatus,
  ElevatedLaunchResult,
} from '../../electron/shared/ipc-types';

// O tema importa o BatmanBackground, que instancia `Path2D` no topo do módulo.
vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

// O toast dispara `Audio`/`sonner`; aqui só interessa o que o contexto pediu.
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('../components/EnhancedToast', () => ({ showEnhancedToast: toastSpy }));

import { AutoCleanProvider, useAutoCleanContext } from './AutoCleanContext';
import { SettingsProvider, useSettingsContext } from './SettingsContext';

const AUTO_CLEAN_SETTINGS: AutoCleanSettings = {
  enabled: true,
  cleaners: ['cleaner-1'],
  frequency: 'daily',
  weekday: null,
  dayOfMonth: null,
  time: '03:00',
  runOnStartup: false,
  catchUp: true,
  lastRunAt: null,
  nextRunAt: null,
  pending: [],
};

const SAVED: AppSettings = {
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
    lockedPages: [],
    unlocked: false,
  },
  soundEnabled: false,
  toastDuration: 'medium',
  adbPath: null,
  autoClean: AUTO_CLEAN_SETTINGS,
};

const STATUS: AutoCleanStatus = {
  settings: AUTO_CLEAN_SETTINGS,
  isAdmin: false,
  running: false,
};

function installApi() {
  let statusCb: ((status: AutoCleanStatus) => void) | null = null;
  let finishedCb: ((result: AutoCleanRunResult) => void) | null = null;
  const offStatus = vi.fn();
  const offFinished = vi.fn();

  const api = {
    getSettings: vi.fn<() => Promise<AppSettings>>(async () => SAVED),
    saveSettings: vi.fn<(settings: AppSettings) => Promise<void>>(async () => undefined),
    getAutoCleanStatus: vi.fn<() => Promise<AutoCleanStatus>>(async () => STATUS),
    runCleanerNow: vi.fn<(ids: string[]) => Promise<AutoCleanRunResult>>(async () => ({
      ran: ['cleaner-1'],
      pending: [],
      failed: [],
    })),
    runAutoCleanPending: vi.fn<() => Promise<AutoCleanRunResult>>(async () => ({
      ran: [],
      pending: ['cleaner-1'],
      failed: [],
    })),
    discardPendingCleaners: vi.fn<(ids: string[]) => Promise<AutoCleanStatus>>(async () => ({
      ...STATUS,
      settings: { ...AUTO_CLEAN_SETTINGS, pending: [] },
    })),
    elevateApp: vi.fn<() => Promise<ElevatedLaunchResult>>(async () => ({
      launched: true,
      cancelled: false,
    })),
    onAutoCleanStatus: vi.fn((cb: (status: AutoCleanStatus) => void) => {
      statusCb = cb;
      return offStatus;
    }),
    onAutoCleanFinished: vi.fn((cb: (result: AutoCleanRunResult) => void) => {
      finishedCb = cb;
      return offFinished;
    }),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;

  return {
    api,
    offStatus,
    offFinished,
    emitStatus(status: AutoCleanStatus) {
      statusCb?.(status);
    },
    emitFinished(result: AutoCleanRunResult) {
      finishedCb?.(result);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const { status, updateConfig, runNow, runPending, discard, relaunchAsAdmin } =
    useAutoCleanContext();
  const { settings } = useSettingsContext();
  const [last, setLast] = useState('');

  return (
    <div>
      <span data-testid="status">
        {status
          ? [
              String(status.settings.enabled),
              status.settings.time,
              status.settings.cleaners.join('+'),
              status.settings.pending.join('+'),
              String(status.running),
              String(status.isAdmin),
            ].join('|')
          : 'null'}
      </span>
      <span data-testid="saved-time">{settings.autoClean.time}</span>
      <span data-testid="last">{last}</span>
      <button type="button" onClick={() => updateConfig({ enabled: false, time: '05:00' })}>
        configurar
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await runNow(['cleaner-1']);
          setLast(`ran:${result.ran.join('+')}`);
        }}
      >
        rodar agora
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await runPending();
          setLast(`pending:${result.pending.join('+')}`);
        }}
      >
        rodar pendentes
      </button>
      <button
        type="button"
        onClick={async () => {
          await discard(['cleaner-2']);
          setLast('descartado');
        }}
      >
        descartar
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await relaunchAsAdmin();
          setLast(`launched:${String(result.launched)}`);
        }}
      >
        elevar
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SettingsProvider>
      <AutoCleanProvider>
        <Probe />
      </AutoCleanProvider>
    </SettingsProvider>
  );
}

async function waitForLoad() {
  await waitFor(() =>
    expect(screen.getByTestId('status').textContent).toBe('true|03:00|cleaner-1||false|false')
  );
  await waitFor(() => expect(screen.getByTestId('saved-time').textContent).toBe('03:00'));
}

beforeEach(() => {
  toastSpy.mockClear();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('AutoCleanProvider', () => {
  it('começa sem status e publica o estado lido', async () => {
    const harness = installApi();
    const pending = deferred<AutoCleanStatus>();
    harness.api.getAutoCleanStatus.mockImplementation(() => pending.promise);
    renderProvider();

    expect(screen.getByTestId('status').textContent).toBe('null');

    await act(async () => {
      pending.resolve(STATUS);
      await pending.promise;
    });

    await waitForLoad();
  });

  it('mantém status nulo e loga quando a leitura inicial falha', async () => {
    const harness = installApi();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.api.getAutoCleanStatus.mockRejectedValue(new Error('sem status'));
    renderProvider();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Falha ao ler estado da limpeza automática:',
        expect.any(Error)
      )
    );
    expect(screen.getByTestId('status').textContent).toBe('null');

    consoleError.mockRestore();
  });

  it('não salva configuração antes do status chegar', async () => {
    const harness = installApi();
    harness.api.getAutoCleanStatus.mockImplementation(() => new Promise<AutoCleanStatus>(() => {}));
    renderProvider();

    act(() => screen.getByRole('button', { name: 'configurar' }).click());

    expect(harness.api.saveSettings).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('null');
  });

  it('mescla a alteração no status e persiste o autoClean completo', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    act(() => screen.getByRole('button', { name: 'configurar' }).click());

    expect(screen.getByTestId('status').textContent).toBe('false|05:00|cleaner-1||false|false');
    expect(harness.api.saveSettings).toHaveBeenCalledTimes(1);
    expect(harness.api.saveSettings).toHaveBeenCalledWith({
      ...SAVED,
      autoClean: { ...AUTO_CLEAN_SETTINGS, enabled: false, time: '05:00' },
    });
  });

  it('roda a limpeza agora e atualiza o status em seguida', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();
    const antes = harness.api.getAutoCleanStatus.mock.calls.length;

    await act(async () => screen.getByRole('button', { name: 'rodar agora' }).click());

    expect(harness.api.runCleanerNow).toHaveBeenCalledWith(['cleaner-1']);
    expect(harness.api.getAutoCleanStatus.mock.calls.length).toBe(antes + 1);
    expect(screen.getByTestId('last').textContent).toBe('ran:cleaner-1');
  });

  it('roda as pendências e devolve o resultado do main', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();
    const antes = harness.api.getAutoCleanStatus.mock.calls.length;

    await act(async () => screen.getByRole('button', { name: 'rodar pendentes' }).click());

    expect(harness.api.runAutoCleanPending).toHaveBeenCalledTimes(1);
    expect(harness.api.getAutoCleanStatus.mock.calls.length).toBe(antes + 1);
    expect(screen.getByTestId('last').textContent).toBe('pending:cleaner-1');
  });

  it('descarta pendências e adota o status devolvido', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    await act(async () => screen.getByRole('button', { name: 'descartar' }).click());

    expect(harness.api.discardPendingCleaners).toHaveBeenCalledWith(['cleaner-2']);
    expect(screen.getByTestId('status').textContent).toBe('true|03:00|cleaner-1||false|false');
    expect(screen.getByTestId('last').textContent).toBe('descartado');
  });

  it('não mostra toast quando a elevação foi aceita', async () => {
    installApi();
    renderProvider();
    await waitForLoad();

    await act(async () => screen.getByRole('button', { name: 'elevar' }).click());

    expect(screen.getByTestId('last').textContent).toBe('launched:true');
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('avisa quando a elevação é cancelada', async () => {
    const harness = installApi();
    harness.api.elevateApp.mockResolvedValue({ launched: false, cancelled: true });
    renderProvider();
    await waitForLoad();

    await act(async () => screen.getByRole('button', { name: 'elevar' }).click());

    expect(harness.api.elevateApp).toHaveBeenCalledWith(undefined, undefined, undefined, true);
    expect(toastSpy).toHaveBeenCalledWith({
      type: 'info',
      title: 'Elevação cancelada',
      description: 'As pendências continuam aguardando.',
      duration: 'long',
      sound: false,
    });
  });

  it('avisa quando a elevação falha', async () => {
    const harness = installApi();
    harness.api.elevateApp.mockResolvedValue({
      launched: false,
      cancelled: false,
      error: 'UAC bloqueado',
    });
    renderProvider();
    await waitForLoad();

    await act(async () => screen.getByRole('button', { name: 'elevar' }).click());

    expect(toastSpy).toHaveBeenCalledWith({
      type: 'error',
      title: 'Não foi possível elevar',
      description: 'UAC bloqueado',
      duration: 'long',
      sound: false,
    });
  });

  it('acompanha o status enviado pelo main', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    act(() =>
      harness.emitStatus({
        ...STATUS,
        isAdmin: true,
        running: true,
        settings: { ...AUTO_CLEAN_SETTINGS, pending: ['cleaner-3'] },
      })
    );

    expect(screen.getByTestId('status').textContent).toBe(
      'true|03:00|cleaner-1|cleaner-3|true|true'
    );
  });

  it('mostra toast de sucesso quando a limpeza termina', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    act(() => harness.emitFinished({ ran: ['cleaner-1', 'cleaner-3'], pending: [], failed: [] }));

    expect(toastSpy).toHaveBeenCalledWith({
      type: 'success',
      title: 'Limpeza automática',
      description: 'Executadas: Limpeza Rápida, Limpeza de Navegadores',
      duration: 'long',
      sound: false,
    });
  });

  it('distingue limpeza parcial e falhas no toast', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    act(() => harness.emitFinished({ ran: ['cleaner-1'], pending: ['cleaner-2'], failed: [] }));
    expect(toastSpy).toHaveBeenLastCalledWith({
      type: 'success',
      title: 'Limpeza automática parcial',
      description: 'Executadas: Limpeza Rápida · Aguardando admin: Limpeza de Atualizações',
      duration: 'long',
      sound: false,
    });

    act(() => harness.emitFinished({ ran: [], pending: [], failed: ['cleaner-4'] }));
    expect(toastSpy).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Limpeza automática',
      description: 'Falharam: Limpeza Total',
      duration: 'long',
      sound: false,
    });
  });

  it('não mostra toast quando o resultado vem vazio', async () => {
    const harness = installApi();
    renderProvider();
    await waitForLoad();

    act(() => harness.emitFinished({ ran: [], pending: [], failed: [] }));

    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('remove os listeners ao desmontar', async () => {
    const harness = installApi();
    const { unmount } = renderProvider();
    await waitForLoad();

    unmount();

    expect(harness.offStatus).toHaveBeenCalled();
    expect(harness.offFinished).toHaveBeenCalled();
  });
});

describe('useAutoCleanContext', () => {
  it('falha fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      'useAutoCleanContext must be used within AutoCleanProvider'
    );

    consoleError.mockRestore();
  });
});
