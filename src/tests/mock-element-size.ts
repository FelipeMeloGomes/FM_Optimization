/**
 * Mock para Element.getBoundingClientRect e ResizeObserver
 * Usado pelo @tanstack/react-virtual para medir linhas da tabela
 */
import { vi } from 'vitest';

const defaultRect = {
  width: 800,
  height: 400,
  top: 0,
  left: 0,
  bottom: 400,
  right: 800,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

// Proper ResizeObserver mock class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

export function mockElementSize(overrides: Partial<typeof defaultRect> = {}) {
  const rect = { ...defaultRect, ...overrides };

  // Mock getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn(() => rect);

  // Mock ResizeObserver
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
