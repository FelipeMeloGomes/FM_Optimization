import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, Menu, Notification, powerMonitor, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { AutoCleanStatus } from '../shared/ipc-types';
import { appState } from './app-state';
import { registerIpcHandlers } from './ipc-handlers';
import { resolveScriptId } from './legacy-script-ids';
import { isAdmin, isAdminAsync } from './services/admin-check';
import { getAutoCleanScheduler } from './services/auto-clean';
import { executeScript } from './services/script-executor';
import { loadScripts } from './services/script-registry';
import {
  clearHandoverRequest,
  clearInstanceInfo,
  isProcessAlive,
  readHandoverRequest,
  readInstanceInfo,
  readNumericArg,
  waitForProcessExit,
  writeHandoverRequest,
  writeInstanceInfo,
} from './services/single-instance';
import { destroyTray, ensureTray, isTrayActive, refreshTray } from './tray';
import { DnsAddressesSchema } from './validation';
import {
  applyChromiumBackgroundSwitches,
  canFocus,
  resolveCloseAction,
  shouldCreateWindowAtBoot,
  shouldShowWindow,
  type WindowMode,
} from './window-policy';

let mainWindow: BrowserWindow | null = null;

export { mainWindow };

const startedHidden = process.argv.includes('--hidden');
const waitPidArg = readNumericArg(process.argv, '--wait-pid');

// O Chromium lê a command line uma única vez, no boot.
applyChromiumBackgroundSwitches(app.commandLine);

// Valida que o scriptId pertence à allowlist de scripts conhecidos.
function isValidScriptId(scriptId: string): boolean {
  const scripts = loadScripts();
  return scripts.some((s) => s.id === resolveScriptId(scriptId));
}

// Handle elevated script execution argument
function handleElevatedScript(): boolean {
  const args = process.argv.slice(1);
  const elevateIndex = args.indexOf('--elevate-script');
  if (elevateIndex !== -1 && elevateIndex + 1 < args.length) {
    const scriptId = args[elevateIndex + 1];
    if (!isValidScriptId(scriptId)) {
      console.error('Blocked elevated script: invalid scriptId', scriptId);
      return true;
    }
    // Normalise before executing so history records the current id.
    const currentId = resolveScriptId(scriptId);
    // Wait a bit for window to be ready, then execute
    setTimeout(() => {
      if (canFocus(mainWindow)) {
        try {
          executeScript(currentId);
        } catch (e) {
          console.error('Failed to execute elevated script:', e);
        }
      }
    }, 1000);
    return true;
  }

  // Handle elevated DNS apply argument
  const elevateDnsIndex = args.indexOf('--elevate-dns');
  if (elevateDnsIndex !== -1 && elevateDnsIndex + 2 < args.length) {
    const interfaceIndex = parseInt(args[elevateDnsIndex + 1], 10);
    const addressesJson = args[elevateDnsIndex + 2];
    if (!Number.isNaN(interfaceIndex) && addressesJson) {
      let addresses: unknown;
      try {
        addresses = JSON.parse(addressesJson);
      } catch {
        console.error('Blocked elevated DNS: invalid addresses JSON');
        return true;
      }
      const parsed = DnsAddressesSchema.safeParse(addresses);
      if (!parsed.success) {
        console.error('Blocked elevated DNS: addresses failed validation');
        return true;
      }
      setTimeout(() => {
        if (canFocus(mainWindow)) {
          try {
            applyDnsElevated(interfaceIndex, parsed.data);
          } catch (e) {
            console.error('Failed to apply elevated DNS:', e);
          }
        }
      }, 1000);
    }
    return true;
  }

  return false;
}

async function applyDnsElevated(interfaceIndex: number, addresses: string[]): Promise<void> {
  const { execPowerShellSafe } = await import('./services/powershell');

  if (addresses.length === 0) {
    await execPowerShellSafe('Set-DnsClientServerAddress', [
      '-InterfaceIndex',
      interfaceIndex.toString(),
      '-ResetServerAddresses',
    ]);
  } else {
    await execPowerShellSafe('Set-DnsClientServerAddress', [
      '-InterfaceIndex',
      interfaceIndex.toString(),
      '-ServerAddresses',
      addresses.join(','),
    ]);
    await execPowerShellSafe('ipconfig', ['/flushdns']);
  }

  // Notify renderer of success
  sendToRenderer('dns-applied', { success: true });
}

function iconPath(): string {
  return app.isPackaged
    ? resolve(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../resources/icon.ico');
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (!canFocus(mainWindow)) return;
  mainWindow.webContents.send(channel, ...args);
}

function focusMainWindow(): void {
  if (!canFocus(mainWindow)) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Porta de entrada única da janela: a bandeja, a segunda instância e o evento
 * `activate` chamam isto. Se a janela foi destruída ao fechar, recria.
 */
function openMainWindow(): void {
  if (!canFocus(mainWindow)) {
    createWindow('on-demand');
    return;
  }
  focusMainWindow();
}

/**
 * Decide se esta instância pode seguir. Devolve false quando outra instância
 * deve continuar dona do app (esta então encerra).
 */
async function ensureSingleInstance(): Promise<boolean> {
  // Relançamento elevado: a instância antiga já combinou encerrar, então
  // esperamos ela sair e pedimos o lock uma única vez.
  if (waitPidArg !== null) {
    const exited = await waitForProcessExit(waitPidArg, 10_000);
    if (exited && app.requestSingleInstanceLock()) return true;
    dialog.showErrorBox(
      'FM Optimize',
      'Não foi possível assumir o aplicativo. Feche todas as janelas do FM Optimize e abra novamente.'
    );
    return false;
  }

  const other = readInstanceInfo();
  const otherAlive = other !== null && other.pid !== process.pid && isProcessAlive(other.pid);
  const elevated = isAdmin();

  if (otherAlive && elevated && !other.elevated) {
    // Abertura manual como admin com uma instância normal viva: pedimos o
    // handover por arquivo (não depende de WM_COPYDATA entre integridades).
    writeHandoverRequest(process.pid);
    const exited = await waitForProcessExit(other.pid, 10_000);
    clearHandoverRequest();
    if (exited && app.requestSingleInstanceLock()) return true;
    dialog.showErrorBox(
      'FM Optimize',
      'O FM Optimize não liberou a instância anterior. Feche-o pelo ícone da bandeja e abra novamente como administrador.'
    );
    return false;
  }

  if (otherAlive && !elevated && other.elevated) {
    dialog.showErrorBox(
      'FM Optimize',
      'O FM Optimize já está aberto como administrador. Feche-o antes de abrir uma instância normal.'
    );
    return false;
  }

  return app.requestSingleInstanceLock();
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update-status', 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update-status', 'available');
    sendToRenderer('update-info', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('update-status', 'not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-status', 'downloading');
    sendToRenderer('download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('update-status', 'ready');
  });

  autoUpdater.on('error', (err) => {
    sendToRenderer('update-status', 'error');
    sendToRenderer('update-info', { version: '', error: err.message });
  });

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'FelipeMeloGomes',
    repo: 'FM_Optimization',
  });
  // Check de atualização só manual via botão em Configurações.
}

function createWindow(mode: WindowMode): void {
  const showOnReady = shouldShowWindow(mode, startedHidden);
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    show: false,
    title: 'FM Optimize',
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // O app nao tem campo de texto livre; carregar dicionarios hunspell no
      // renderer so gastaria memoria.
      spellcheck: false,
      // Content Security Policy
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Content Security Policy via additionalArguments
      // CSP is enforced via the webSecurity flag and the preload script
    },
  });
  mainWindow = window;

  window.on('ready-to-show', () => {
    if (showOnReady) window.show();
  });

  window.on('close', (event) => {
    // Com a bandeja ativa, fechar destroi a janela (libera renderer e processo
    // GPU) e o app continua no icone. Sem bandeja, fecha de verdade.
    if (resolveCloseAction(appState.isQuitting, isTrayActive()) !== 'destroy') return;
    event.preventDefault();
    showTrayHintOnce();
    window.destroy();
  });

  window.on('closed', () => {
    // Uma referencia morta quebraria focusMainWindow/sendToRenderer; o proximo
    // clique na bandeja recria a janela do zero.
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url);
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        shell.openExternal(details.url);
      }
    } catch {
      /* invalid URL */
    }
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/**
 * A instância primária observa pedidos de handover feitos por uma instância
 * elevada. Encerra só depois que o pedido é lido — todo estado já está em disco
 * (settings.json/settings são gravados de forma síncrona e atômica).
 */
function watchHandoverRequests(): NodeJS.Timeout {
  return setInterval(() => {
    const request = readHandoverRequest();
    if (!request || !isProcessAlive(request.pid)) return;
    clearHandoverRequest();
    appState.isQuitting = true;
    app.quit();
  }, 1_000);
}

function trayHintPath(): string {
  return join(app.getPath('userData'), 'tray-hint-shown');
}

function showTrayHintOnce(): void {
  if (existsSync(trayHintPath())) return;
  if (Notification.isSupported()) {
    new Notification({
      title: 'FM Optimize',
      body: 'O app continua na bandeja. Use o ícone para abrir ou sair.',
      silent: true,
    }).show();
  }
  try {
    writeFileSync(trayHintPath(), new Date().toISOString(), 'utf-8');
  } catch {
    /* sem permissão de escrita: a dica aparece de novo na próxima vez */
  }
}

/**
 * Liga o agendador, o tray e o autostart. O tray só existe com a limpeza
 * automática ligada: para quem não usa a feature, fechar continua encerrando.
 */
function setupAutoClean(isElevated: boolean): void {
  const scheduler = getAutoCleanScheduler();

  const handlers = {
    onOpen: () => openMainWindow(),
    onRunNow: () => {
      void scheduler.runNow(scheduler.getStatus().settings.cleaners);
    },
    onRunPending: () => {
      void scheduler.runNow(scheduler.getStatus().settings.pending);
    },
    onQuit: () => {
      appState.isQuitting = true;
      app.quit();
    },
  };

  const applyStatus = (status: AutoCleanStatus): void => {
    if (status.settings.enabled) {
      ensureTray(iconPath(), handlers);
      refreshTray(status.settings.pending.length);
      return;
    }
    destroyTray();
    // Sem bandeja a janela é a única porta de entrada do app: recria se ela foi
    // destruída ao fechar e mostra se estiver só escondida.
    if (!canFocus(mainWindow)) {
      if (!appState.isQuitting) createWindow('on-demand');
      return;
    }
    if (!mainWindow.isVisible()) mainWindow.show();
  };

  scheduler.subscribe(applyStatus);

  scheduler.start();
  scheduler.syncLaunchAtLogin();

  const status = scheduler.getStatus();
  applyStatus(status);

  // Rodar pendências quando o app abre elevado: seja pelo botão do app, seja
  // quando o usuário abre o executável como administrador por conta própria.
  const explicitIntent =
    process.argv.includes('--relaunch-elevated') ||
    (isElevated && status.settings.pending.length > 0);
  const delayMs = startedHidden && !explicitIntent ? 3 * 60_000 : 0;
  void scheduler.catchUp({ explicitIntent, delayMs });

  powerMonitor.on('resume', () => {
    scheduler.handleResume();
  });
}

async function bootstrap(): Promise<void> {
  const acquired = await ensureSingleInstance();
  if (!acquired) {
    app.quit();
    return;
  }

  // Verifica privilégios de admin de forma assíncrona para não bloquear o boot.
  const elevated = await isAdminAsync();

  // A instância elevada que assumiu o lugar da anterior também é dona do
  // estado: escreve seu pid para o próximo handover.
  writeInstanceInfo({
    pid: process.pid,
    elevated,
    startedAt: new Date().toISOString(),
  });
  clearHandoverRequest();

  app.on('before-quit', () => {
    // OS desligando, atualização ou Cmd+Q: sem isso o handler de close
    // esconderia a janela e abortaria o encerramento.
    appState.isQuitting = true;
  });

  app.on('second-instance', () => {
    void app.whenReady().then(openMainWindow);
  });

  const handoverWatcher = watchHandoverRequests();

  app.on('will-quit', () => {
    clearInterval(handoverWatcher);
    clearInstanceInfo(process.pid);
  });

  await app.whenReady();

  Menu.setApplicationMenu(null);
  electronApp.setAppUserModelId('com.fmoptimize');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();
  setupAutoUpdater();

  // Com --hidden (autostart) a janela nasce so quando o usuario pedir: sem
  // janela nao existe renderer nem processo GPU (~180 MB). Nao acesse a sessao
  // padrao aqui: so tocar nela ja faz o Chromium subir um processo renderer
  // (~20 MB) mesmo sem janela. O spellcheck e desligado em webPreferences.
  if (shouldCreateWindowAtBoot(process.argv)) createWindow('boot');
  setupAutoClean(elevated);

  // Handle elevated script execution after window is created
  handleElevatedScript();

  app.on('activate', () => {
    openMainWindow();
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar o FM Optimize:', error);
  dialog.showErrorBox(
    'FM Optimize',
    error instanceof Error ? error.message : 'Erro inesperado ao iniciar.'
  );
  app.quit();
});

app.on('window-all-closed', () => {
  if (isTrayActive()) return;
  if (process.platform !== 'darwin') app.quit();
});
