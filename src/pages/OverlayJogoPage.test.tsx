// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GameDisplayModeInfo,
  OverlayGame,
  OverlaySettings,
  OverlayStatus,
} from '../../electron/shared/overlay-types';
import { DEFAULT_OVERLAY_SETTINGS } from '../../electron/shared/overlay-types';
import OverlayJogoPage from './OverlayJogoPage';

const cs2: OverlayGame = {
  id: 'cs2',
  name: 'Counter-Strike 2',
  exePath: 'C:\\Jogos\\CS2\\cs2.exe',
  processName: 'cs2.exe',
  coverFile: null,
  enabled: true,
};

const batman: OverlayGame = {
  id: 'batman',
  name: 'Batman Arkham Knight',
  exePath: 'C:\\Jogos\\Batman Arkham Knight\\Binaries\\Win64\\BatmanAK.exe',
  processName: 'BatmanAK.exe',
  coverFile: null,
  enabled: true,
};

const idleStatus: OverlayStatus = {
  capture: 'idle',
  activeGameId: null,
  runningGameIds: [],
  message: null,
};

function installApi(
  options: {
    games?: OverlayGame[];
    settings?: OverlaySettings;
    status?: OverlayStatus;
    chosenPath?: string | null;
    coverUrl?: string | null;
    displayModes?: Record<string, GameDisplayModeInfo>;
  } = {}
) {
  const games = options.games ?? [cs2];
  const api = {
    getOverlayGames: vi.fn(async () => games),
    addOverlayGame: vi.fn(async (input: { exePath: string }) => ({
      ...cs2,
      id: input.exePath.toLowerCase(),
      exePath: input.exePath,
      processName: input.exePath.split('\\').pop() ?? 'jogo.exe',
      name: 'Novo Jogo',
    })),
    removeOverlayGame: vi.fn(async () => {}),
    setOverlayGameEnabled: vi.fn(async () => {}),
    getOverlaySettings: vi.fn(async () => options.settings ?? DEFAULT_OVERLAY_SETTINGS),
    saveOverlaySettings: vi.fn(async () => {}),
    getOverlayStatus: vi.fn(async () => options.status ?? idleStatus),
    startOverlayMonitor: vi.fn(async () => {}),
    stopOverlayMonitor: vi.fn(async () => {}),
    restartOverlayElevated: vi.fn(async () => {}),
    chooseOverlayExe: vi.fn(async () =>
      options.chosenPath ? { exePath: options.chosenPath } : null
    ),
    launchOverlayGame: vi.fn(async () => {}),
    getOverlayCover: vi.fn(async () => options.coverUrl ?? null),
    getGameDisplayMode: vi.fn(
      async (id: string) => options.displayModes?.[id] ?? { mode: 'unknown' as const }
    ),
    setGameBorderless: vi.fn(async () => ({ mode: 'borderless' as const })),
    onOverlayStatus: vi.fn(() => () => {}),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('OverlayJogoPage', () => {
  it('abre com a lista, a engrenagem e o aviso de borderless', async () => {
    installApi();
    render(<OverlayJogoPage />);

    expect(await screen.findByRole('heading', { name: 'Overlay de jogo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /configurações do overlay/i })).toBeTruthy();
    expect(screen.getByText(/tela cheia exclusiva não é suportada/i)).toBeTruthy();
    expect(screen.getByText('Counter-Strike 2')).toBeTruthy();
    expect(screen.getByText('cs2.exe')).toBeTruthy();
    expect(screen.getByText('CS')).toBeTruthy();
  });

  it('adiciona um jogo escolhendo o executável', async () => {
    const api = installApi({ chosenPath: 'C:\\Jogos\\Novo\\novo.exe' });
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /adicionar jogo/i }));
    await waitFor(() =>
      expect(api.addOverlayGame).toHaveBeenCalledWith({ exePath: 'C:\\Jogos\\Novo\\novo.exe' })
    );
    expect(await screen.findByText('Novo Jogo')).toBeTruthy();
  });

  it('inicia o jogo pelo botão do card', async () => {
    const api = installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /iniciar counter-strike 2/i }));

    expect(api.launchOverlayGame).toHaveBeenCalledWith('cs2');
  });

  it('mostra o erro quando o executável do jogo não abre', async () => {
    const api = installApi();
    api.launchOverlayGame.mockRejectedValueOnce(new Error('arquivo não encontrado'));
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /iniciar counter-strike 2/i }));

    expect(await screen.findByText('arquivo não encontrado')).toBeTruthy();
  });

  it('alterna um jogo habilitado', async () => {
    const api = installApi();
    render(<OverlayJogoPage />);
    const toggle = await screen.findByRole('switch', { name: /counter-strike 2/i });
    fireEvent.click(toggle);
    expect(api.setOverlayGameEnabled).toHaveBeenCalledWith({ id: 'cs2', enabled: false });
  });

  it('abre o painel da engrenagem e salva as configurações', async () => {
    const api = installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.change(await screen.findByLabelText('FPS alvo'), { target: { value: '144' } });
    fireEvent.change(screen.getByLabelText('Posição'), { target: { value: 'bottom-right' } });
    fireEvent.change(screen.getByLabelText('Opacidade'), { target: { value: '0.7' } });
    fireEvent.change(screen.getByLabelText('Atalho'), { target: { value: 'F9' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar configurações/i }));

    await waitFor(() =>
      expect(api.saveOverlaySettings).toHaveBeenCalledWith({
        hotkey: 'F9',
        position: 'bottom-right',
        opacity: 0.7,
        targetFps: 144,
        onlyWhenFocused: true,
      })
    );
  });

  it('atualiza a posição da prévia ao mudar a posição', async () => {
    installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.change(screen.getByLabelText('Posição'), { target: { value: 'bottom-right' } });

    expect(screen.getByText('142').parentElement?.className).toContain('bottom-3 right-3');
  });

  it('aplica a opacidade escolhida na prévia', async () => {
    installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.change(screen.getByLabelText('Opacidade'), { target: { value: '0.5' } });

    expect((screen.getByText('142').parentElement as HTMLElement).style.opacity).toBe('0.5');
  });

  it('muda a cor da prévia quando o FPS alvo fica acima do FPS de exemplo', async () => {
    installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    expect(screen.getByText('142').className).toContain('text-success');

    fireEvent.change(screen.getByLabelText('FPS alvo'), { target: { value: '144' } });

    expect(screen.getByText('142').className).toContain('text-destructive');
  });

  it('oferece relançar elevado quando falta privilégio', async () => {
    const api = installApi({
      status: {
        capture: 'error',
        activeGameId: null,
        runningGameIds: [],
        message: 'PresentMon exige privilégio de administrador.',
      },
    });
    render(<OverlayJogoPage />);

    expect(await screen.findByText(/privilégio de administrador/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reiniciar como administrador/i }));
    expect(api.restartOverlayElevated).toHaveBeenCalled();
  });

  it('grava o atalho a partir da tecla pressionada', async () => {
    const api = installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    fireEvent.keyDown(window, { key: 'F9', code: 'F9', ctrlKey: true, shiftKey: true });

    expect((screen.getByLabelText('Atalho') as HTMLInputElement).value).toBe('Ctrl+Shift+F9');
    fireEvent.click(screen.getByRole('button', { name: /salvar configurações/i }));
    await waitFor(() => expect(api.saveOverlaySettings).toHaveBeenCalled());
  });

  it('ignora AltGraph ao gravar o atalho', async () => {
    installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    fireEvent.keyDown(window, { key: 'AltGraph', code: 'AltRight', ctrlKey: true, altKey: true });

    expect((screen.getByLabelText('Atalho') as HTMLInputElement).value).toBe('Ctrl+Shift+F');
  });

  it('recusa salvar um atalho inválido digitado', async () => {
    const api = installApi();
    render(<OverlayJogoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /configurações do overlay/i }));
    fireEvent.change(screen.getByLabelText('Atalho'), { target: { value: 'AltGraph' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar configurações/i }));

    expect(api.saveOverlaySettings).not.toHaveBeenCalled();
    expect(await screen.findByText(/atalho inválido/i)).toBeTruthy();
  });

  it('mostra a capa da Steam quando o jogo tem uma', async () => {
    const covered: OverlayGame = { ...cs2, coverFile: '730.jpg' };
    const api = installApi({ games: [covered], coverUrl: 'data:image/jpeg;base64,Y2FwYQ==' });
    render(<OverlayJogoPage />);

    expect(await screen.findByRole('img')).toBeTruthy();
    expect(api.getOverlayCover).toHaveBeenCalledWith('730.jpg');
    expect(screen.queryByText('CS')).toBeNull();
  });

  it('mostra aviso quando o atalho global está ocupado', async () => {
    installApi({
      status: {
        ...idleStatus,
        warning: 'O atalho Ctrl+Shift+F já está em uso por outro aplicativo.',
      },
    });
    render(<OverlayJogoPage />);
    expect(await screen.findByText(/já está em uso/)).toBeTruthy();
  });

  it('mostra o FPS atual quando o jogo está capturando', async () => {
    installApi({
      status: {
        capture: 'capturing',
        activeGameId: 'cs2',
        runningGameIds: ['cs2'],
        message: null,
      },
    });
    render(<OverlayJogoPage />);
    expect(await screen.findByText(/rodando/i)).toBeTruthy();
  });

  it('oferece trocar para borderless quando o jogo está em tela cheia exclusiva', async () => {
    const api = installApi({
      games: [batman],
      displayModes: { batman: { mode: 'exclusive' } },
    });
    render(<OverlayJogoPage />);

    expect(
      await screen.findByText(/batman arkham knight está em tela cheia exclusiva/i)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /usar borderless/i }));

    await waitFor(() => expect(api.setGameBorderless).toHaveBeenCalledWith('batman'));
    expect(await screen.findByText(/reinicie o jogo para ver o fps/i)).toBeTruthy();
  });

  it('informa borderless sem oferecer a troca quando o jogo já está pronto', async () => {
    const api = installApi({
      games: [batman],
      displayModes: { batman: { mode: 'borderless' } },
    });
    render(<OverlayJogoPage />);

    expect(await screen.findByText(/borderless · overlay pronto/i)).toBeTruthy();
    expect(api.setGameBorderless).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /usar borderless/i })).toBeNull();
  });
});
