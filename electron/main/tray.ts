import { Menu, nativeImage, Tray } from 'electron';

interface TrayHandlers {
  onOpen: () => void;
  onRunNow: () => void;
  onRunPending: () => void;
  onQuit: () => void;
}

let tray: Tray | null = null;
let currentHandlers: TrayHandlers | null = null;
let lastPendingCount = 0;

export function isTrayActive(): boolean {
  return tray !== null;
}

export function ensureTray(iconPath: string, handlers: TrayHandlers): void {
  currentHandlers = handlers;
  if (tray) return;

  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? iconPath : image);
  tray.setToolTip('FM Optimize');
  tray.on('click', () => {
    currentHandlers?.onOpen();
  });
  tray.on('double-click', () => {
    currentHandlers?.onOpen();
  });
  refreshTray(lastPendingCount);
}

/** Reconstrói o menu quando muda a quantidade de pendências. */
export function refreshTray(pendingCount: number): void {
  lastPendingCount = pendingCount;
  if (!tray || !currentHandlers) return;

  const handlers = currentHandlers;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'Abrir FM Optimize', click: () => handlers.onOpen() },
    { type: 'separator' },
    { label: 'Executar limpeza agora', click: () => handlers.onRunNow() },
  ];

  if (pendingCount > 0) {
    template.push({
      label: `Executar pendências (${pendingCount})`,
      click: () => handlers.onRunPending(),
    });
  }

  template.push({ type: 'separator' }, { label: 'Sair', click: () => handlers.onQuit() });

  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(
    pendingCount > 0 ? `FM Optimize — ${pendingCount} limpeza(s) pendente(s)` : 'FM Optimize'
  );
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
  currentHandlers = null;
  lastPendingCount = 0;
}
