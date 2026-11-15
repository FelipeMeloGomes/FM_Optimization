import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemoryStats, startMemoryMonitor, stopMemoryMonitor } from '../memory-monitor';

interface MinimalWebContents {
  send: ReturnType<typeof vi.fn>;
}

interface MinimalBrowserWindow {
  isDestroyed: ReturnType<typeof vi.fn>;
  webContents: MinimalWebContents;
}

function createMockWindow(overrides: Partial<MinimalBrowserWindow> = {}): MinimalBrowserWindow {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
    ...overrides,
  };
}

function asBrowserWindow(mock: MinimalBrowserWindow): BrowserWindow {
  return mock as unknown as BrowserWindow;
}

describe('memory-monitor', () => {
  describe('getMemoryStats', () => {
    it('returns expected shape with positive numbers', () => {
      const stats = getMemoryStats();
      expect(stats).toEqual(
        expect.objectContaining({
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
          external: expect.any(Number),
        })
      );
      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
      expect(stats.rss).toBeGreaterThan(0);
    });
  });

  describe('startMemoryMonitor/stopMemoryMonitor', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      vi.useFakeTimers();
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      vi.useRealTimers();
      process.env.NODE_ENV = originalEnv;
      stopMemoryMonitor();
    });

    it('does nothing in non-development environment', () => {
      process.env.NODE_ENV = 'production';
      const mockWindow = createMockWindow();
      startMemoryMonitor(asBrowserWindow(mockWindow));
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('sends memory stats at interval in development', () => {
      const mockWindow = createMockWindow();
      startMemoryMonitor(asBrowserWindow(mockWindow), 1000);

      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'memory-stats',
        expect.objectContaining({
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
          external: expect.any(Number),
        })
      );

      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2);
    });

    it('stops sending after window destroyed', () => {
      const mockWindow = createMockWindow();
      startMemoryMonitor(asBrowserWindow(mockWindow), 1000);

      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);

      mockWindow.isDestroyed.mockReturnValue(true);
      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
    });

    it('stopMemoryMonitor clears interval', () => {
      const mockWindow = createMockWindow();
      startMemoryMonitor(asBrowserWindow(mockWindow), 1000);

      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);

      stopMemoryMonitor();
      vi.advanceTimersByTime(1000);
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
    });
  });
});
