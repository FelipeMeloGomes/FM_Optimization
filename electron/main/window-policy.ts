/**
 * Decisões puras do ciclo de vida da janela principal.
 *
 * Vivem fora de `index.ts` para poderem ser testadas sem subir o Electron.
 * A ideia central: a janela é um recurso caro (renderer + processo GPU, ~180 MB)
 * e só deve existir enquanto o usuário está olhando para ela. Na bandeja, quem
 * segura o app de pé é o processo principal.
 */

/** Autostart passa esta flag; o app deve começar sem janela. */
export const HIDDEN_ARG = '--hidden';

/** Tarefas elevadas executam através do renderer, então precisam da janela. */
export const ELEVATED_TASK_ARGS = ['--elevate-script', '--elevate-dns'] as const;

export type WindowMode = 'boot' | 'on-demand';

export type CloseAction = 'destroy' | 'allow-close';

export function hasElevatedTask(argv: readonly string[]): boolean {
  return ELEVATED_TASK_ARGS.some((arg) => argv.includes(arg));
}

/**
 * No boot a janela só nasce quando o usuário vai vê-la. Exceção: pedidos de
 * elevação chegam pelo renderer, então sem janela o script nunca rodaria.
 */
export function shouldCreateWindowAtBoot(argv: readonly string[]): boolean {
  return !argv.includes(HIDDEN_ARG) || hasElevatedTask(argv);
}

/**
 * Uma janela criada sob demanda (clique na bandeja) precisa aparecer mesmo que
 * o processo tenha subido com `--hidden` — senão ela nasceria invisível.
 */
export function shouldShowWindow(mode: WindowMode, startedHidden: boolean): boolean {
  return mode === 'on-demand' || !startedHidden;
}

/**
 * Fechar com a bandeja ativa não encerra o app: a janela é destruída para
 * liberar renderer e GPU e o app continua vivo no ícone. Sem bandeja, ou
 * durante o encerramento, o fechamento segue o fluxo normal do Electron.
 */
export function resolveCloseAction(isQuitting: boolean, trayActive: boolean): CloseAction {
  return !isQuitting && trayActive ? 'destroy' : 'allow-close';
}

/**
 * `BrowserWindow` destruída continua sendo um objeto truthy: usar só `if (win)`
 * estoura em "Object has been destroyed" ao chamar `show()`/`focus()`.
 */
export function canFocus<T extends { isDestroyed(): boolean }>(win: T | null): win is T {
  return win !== null && !win.isDestroyed();
}

/**
 * Rede de fundo do Chromium (variations, component updater, sync, pings) só
 * gasta CPU e RAM num app que fala com a rede apenas ao checar atualização.
 */
export const CHROMIUM_BACKGROUND_SWITCHES = [
  'disable-background-networking',
  'disable-component-update',
  'disable-default-apps',
  'no-first-run',
  'disable-sync',
] as const;

export function applyChromiumBackgroundSwitches(target: {
  appendSwitch(name: string): void;
}): void {
  for (const name of CHROMIUM_BACKGROUND_SWITCHES) target.appendSwitch(name);
}

/**
 * Switches para modo economia: desativam GPU e limitam renderer.
 * Devem ser aplicados antes de app.whenReady().
 */
export const POWER_SAVE_SWITCHES = [
  'disable-gpu',
  'disable-gpu-compositing',
  'disable-software-rasterizer',
  'renderer-process-limit=1',
] as const;

export function applyPowerSaveSwitches(target: { appendSwitch(name: string): void }): void {
  for (const name of POWER_SAVE_SWITCHES) target.appendSwitch(name);
}
