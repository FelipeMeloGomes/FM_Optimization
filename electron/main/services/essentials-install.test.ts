import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  send: vi.fn(),
  windows: [] as {
    isDestroyed: () => boolean;
    webContents: { send: (channel: string, payload: unknown) => void };
  }[],
}));

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => mocks.windows },
  shell: { openExternal: () => Promise.resolve() },
}));

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));

const { installEssential, cancelEssentialInstall } = await import('./essentials');

const ID = 'msi-afterburner';

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  pid = 4242;
  kill = vi.fn();

  write(text: string): void {
    this.stdout.write(text);
  }

  close(code: number | null): void {
    this.emit('close', code);
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('installEssential', () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
    mocks.send.mockReset();
    mocks.windows.length = 0;
    mocks.windows.push({ isDestroyed: () => false, webContents: { send: mocks.send } });
  });

  it('chama o winget com o id exato do pacote e resolve no sucesso', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    child.write('Successfully installed');
    child.close(0);

    await expect(promise).resolves.toEqual({ id: ID, alreadyInstalled: false });
    expect(mocks.spawn).toHaveBeenCalledWith(
      'winget',
      [
        'install',
        '--id',
        'Guru3D.Afterburner',
        '--exact',
        '--source',
        'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
      ],
      { windowsHide: true }
    );
  });

  it('converte a barra de progresso do winget em evento para a UI', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    child.write('  ██████  10.5 MB / 45.8 MB\r');
    await flush();

    expect(mocks.send).toHaveBeenCalledWith('essential-install-progress', {
      id: ID,
      status: 'downloading',
      percent: 23,
    });

    child.close(0);
    await promise;
  });

  it('trata pacote ja instalado como sucesso, sem erro', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    child.write(
      'Found an existing package already installed. Trying to upgrade...\rNo applicable update found'
    );
    child.close(-1978335189);

    await expect(promise).resolves.toEqual({ id: ID, alreadyInstalled: true });
  });

  it('explica a falha do winget com o codigo de saida', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    child.write('Installer failed with exit code: 1603');
    child.close(-1978335215);

    await expect(promise).rejects.toThrow('0x8a150011');
  });

  it('recusa programa que nao existe no catalogo', () => {
    expect(() => installEssential('programa-inexistente')).toThrow('Programa não encontrado.');
  });

  it('nao deixa duas instalacoes do mesmo programa ao mesmo tempo', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    expect(() => installEssential(ID)).toThrow('já está sendo instalado');

    child.close(0);
    await promise;
  });

  it('cancelar mata a arvore de processos e rejeita a promessa', async () => {
    const child = new FakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = installEssential(ID);
    cancelEssentialInstall(ID);

    expect(mocks.spawn).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T', '/F'], {
      windowsHide: true,
    });

    child.close(1);
    await expect(promise).rejects.toThrow('Instalação cancelada.');
  });
});
