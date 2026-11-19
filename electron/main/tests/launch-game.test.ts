import { describe, expect, it, vi } from 'vitest';
import type { OverlayGame } from '../../shared/overlay-types';
import { launchOverlayGame, launchOverlayGameById } from '../services/launch-game';

const cs2: OverlayGame = {
  id: 'cs2',
  name: 'Counter-Strike 2',
  exePath: 'C:\\Jogos\\CS2\\cs2.exe',
  processName: 'cs2.exe',
  coverFile: null,
  enabled: true,
};

describe('launchOverlayGame', () => {
  it('abre o executável cadastrado do jogo', async () => {
    const openPath = vi.fn(async () => '');

    await launchOverlayGame(cs2, { openPath });

    expect(openPath).toHaveBeenCalledWith('C:\\Jogos\\CS2\\cs2.exe');
  });

  it('rejeita com o erro do Windows quando o executável não abre', async () => {
    const openPath = vi.fn(async () => 'arquivo não encontrado');

    await expect(launchOverlayGame(cs2, { openPath })).rejects.toThrow(
      'Não foi possível iniciar Counter-Strike 2: arquivo não encontrado'
    );
  });

  it('abre o executável do jogo identificado pelo id', async () => {
    const openPath = vi.fn(async () => '');

    await launchOverlayGameById('cs2', [cs2], { openPath });

    expect(openPath).toHaveBeenCalledWith('C:\\Jogos\\CS2\\cs2.exe');
  });

  it('rejeita um id de jogo desconhecido sem tentar abrir nada', async () => {
    const openPath = vi.fn(async () => '');

    await expect(launchOverlayGameById('desconhecido', [cs2], { openPath })).rejects.toThrow(
      'Jogo não encontrado.'
    );
    expect(openPath).not.toHaveBeenCalled();
  });
});
