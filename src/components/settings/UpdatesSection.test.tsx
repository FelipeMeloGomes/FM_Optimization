// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DownloadProgress,
  UpdateInfo,
  UpdateStatus,
} from '../../../electron/shared/ipc-types';

/**
 * Regressão da tela de atualizações.
 *
 * O estado vem todo por eventos do main (`onUpdateStatus`, `onUpdateInfo`,
 * `onDownloadProgress`), não por polling. Se uma inscrição deixar de existir ou
 * for cancelada cedo demais, o usuário fica preso em "Verificando..." — e o
 * botão de instalar nunca aparece depois do download.
 */

const api = vi.hoisted(() => {
  const listeners = {
    status: [] as Array<(status: UpdateStatus) => void>,
    info: [] as Array<(info: UpdateInfo) => void>,
    progress: [] as Array<(progress: DownloadProgress) => void>,
  };
  const unsub = {
    status: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
  };

  return {
    listeners,
    unsub,
    checkForUpdate: vi.fn(async () => {}),
    downloadUpdate: vi.fn(async () => {}),
    installUpdate: vi.fn(),
    onUpdateStatus: vi.fn((cb: (status: UpdateStatus) => void) => {
      listeners.status.push(cb);
      return unsub.status;
    }),
    onUpdateInfo: vi.fn((cb: (info: UpdateInfo) => void) => {
      listeners.info.push(cb);
      return unsub.info;
    }),
    onDownloadProgress: vi.fn((cb: (progress: DownloadProgress) => void) => {
      listeners.progress.push(cb);
      return unsub.progress;
    }),
  };
});

import { UpdatesSection } from './UpdatesSection';

function emitStatus(status: UpdateStatus) {
  act(() => {
    for (const cb of api.listeners.status) cb(status);
  });
}

function emitInfo(info: UpdateInfo) {
  act(() => {
    for (const cb of api.listeners.info) cb(info);
  });
}

function emitProgress(progress: DownloadProgress) {
  act(() => {
    for (const cb of api.listeners.progress) cb(progress);
  });
}

function showAvailable(version = '2.20.0') {
  emitInfo({ version });
  emitStatus('available');
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  api.listeners.status.length = 0;
  api.listeners.info.length = 0;
  api.listeners.progress.length = 0;
  api.unsub.status.mockClear();
  api.unsub.info.mockClear();
  api.unsub.progress.mockClear();
  api.checkForUpdate.mockClear();
  api.downloadUpdate.mockClear();
  api.installUpdate.mockClear();
  api.checkForUpdate.mockResolvedValue(undefined);
  api.downloadUpdate.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  openSpy.mockRestore();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('UpdatesSection — estado inicial', () => {
  it('mostra a versão atual e o botão de verificar', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    expect(screen.getByText('2.19.0')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Verificar atualizacoes/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Pagina de download/ })).toBeNull();
  });

  it('mostra a página de download quando não está empacotado', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Pagina de download/ }));

    expect(openSpy).toHaveBeenCalledWith('https://fmoptimize.vercel.app', '_blank');
  });

  it('mostra reticências quando a versão não foi informada', () => {
    render(<UpdatesSection appVersion="" packaged />);

    expect(screen.getByText('...')).not.toBeNull();
  });
});

describe('UpdatesSection — verificação', () => {
  it('entra em "verificando" ao clicar', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    fireEvent.click(screen.getByRole('button', { name: /Verificar atualizacoes/ }));

    expect(api.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Verificando atualizacoes...');
  });

  it('mostra que já está na versão mais recente', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    emitStatus('not-available');

    expect(screen.getByRole('status').textContent).toContain(
      'Voce ja esta na versao mais recente.'
    );
    expect(screen.getByRole('button', { name: /Verificar novamente/ })).not.toBeNull();
  });

  it('cai em erro quando a verificação falha em build empacotado', async () => {
    api.checkForUpdate.mockRejectedValue(new Error('sem rede'));
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    fireEvent.click(screen.getByRole('button', { name: /Verificar atualizacoes/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Falha ao verificar atualizacoes.')
    );
    expect(screen.queryByRole('button', { name: /Pagina de download/ })).toBeNull();
  });

  it('cai em "sem atualização" quando a verificação falha fora do build empacotado', async () => {
    api.checkForUpdate.mockRejectedValue(new Error('dev'));
    render(<UpdatesSection appVersion="2.19.0" packaged={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Verificar atualizacoes/ }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Voce ja esta na versao mais recente.'
      )
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('UpdatesSection — download e instalação', () => {
  it('mostra a versão disponível e dispara o download', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    showAvailable('2.20.0');

    expect(screen.getByRole('status').textContent).toContain('Nova versao v2.20.0 disponivel!');

    fireEvent.click(screen.getByRole('button', { name: /Baixar atualizacao/ }));

    expect(api.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('mostra o progresso e o tamanho baixado', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    emitProgress({
      percent: 42.6,
      bytesPerSecond: 1024,
      total: 10 * 1024 * 1024,
      transferred: 4 * 1024 * 1024,
    });

    const status = screen.getByRole('status').textContent ?? '';
    expect(status).toContain('Baixando atualizacao...');
    expect(status).toContain('43% (4.0/10.0 MB)');
  });

  it('oferece reiniciar e instalar quando o download termina', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    emitStatus('ready');

    expect(screen.getByRole('status').textContent).toContain('Atualizacao baixada com sucesso!');

    fireEvent.click(screen.getByRole('button', { name: /Reiniciar e instalar/ }));

    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it('mostra o erro de download e permite tentar de novo', async () => {
    api.downloadUpdate.mockRejectedValue(new Error('offline'));
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    showAvailable();
    fireEvent.click(screen.getByRole('button', { name: /Baixar atualizacao/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Falha ao baixar atualizacao.')
    );

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(api.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Verificando atualizacoes...');
  });
});

describe('UpdatesSection — eventos', () => {
  it('mostra o erro vindo do main', () => {
    render(<UpdatesSection appVersion="2.19.0" packaged />);

    emitStatus('error');

    expect(screen.getByRole('alert').textContent).toContain('Falha ao verificar atualizacoes.');
  });

  it('cancela as três inscrições ao desmontar', () => {
    const { unmount } = render(<UpdatesSection appVersion="2.19.0" packaged />);
    unmount();

    expect(api.unsub.status).toHaveBeenCalledTimes(1);
    expect(api.unsub.info).toHaveBeenCalledTimes(1);
    expect(api.unsub.progress).toHaveBeenCalledTimes(1);
  });
});
