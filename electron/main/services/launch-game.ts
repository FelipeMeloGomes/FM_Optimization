import { shell } from 'electron';
import type { OverlayGame } from '../../shared/overlay-types';

interface LaunchDeps {
  openPath?: (path: string) => Promise<string>;
}

/** Abre diretamente o executável cadastrado, sem passar por nenhum launcher. */
export async function launchOverlayGame(game: OverlayGame, deps: LaunchDeps = {}): Promise<void> {
  const openPath = deps.openPath ?? shell.openPath;
  const error = await openPath(game.exePath);
  if (error) throw new Error(`Não foi possível iniciar ${game.name}: ${error}`);
}

/** Resolve o id vindo do renderer e abre o executável correspondente. */
export async function launchOverlayGameById(
  id: string,
  games: OverlayGame[],
  deps: LaunchDeps = {}
): Promise<void> {
  const game = games.find((item) => item.id === id);
  if (!game) throw new Error('Jogo não encontrado.');
  await launchOverlayGame(game, deps);
}
