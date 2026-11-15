import type { BrowserWindow } from 'electron';

export function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  };
}

let interval: NodeJS.Timeout | null = null;

export function startMemoryMonitor(window: BrowserWindow, intervalMs = 5000): void {
  if (process.env.NODE_ENV !== 'development') return;
  interval = setInterval(() => {
    if (window?.isDestroyed()) return;
    window.webContents.send('memory-stats', getMemoryStats());
  }, intervalMs);
}

export function stopMemoryMonitor(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
