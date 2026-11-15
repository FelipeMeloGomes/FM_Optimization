import { describe, expect, it } from 'vitest';
import { canFocus, resolveCloseAction } from '../window-policy';

describe('window-policy', () => {
  describe('resolveCloseAction', () => {
    it('returns destroy when tray active and not quitting', () => {
      expect(resolveCloseAction(false, true)).toBe('destroy');
    });

    it('returns allow-close when quitting', () => {
      expect(resolveCloseAction(true, true)).toBe('allow-close');
    });

    it('returns allow-close when tray inactive', () => {
      expect(resolveCloseAction(false, false)).toBe('allow-close');
    });
  });

  describe('canFocus', () => {
    it('returns false for null', () => {
      expect(canFocus(null)).toBe(false);
    });

    it('returns false for destroyed window', () => {
      const destroyedWin = { isDestroyed: () => true };
      expect(canFocus(destroyedWin)).toBe(false);
    });

    it('returns true for valid window', () => {
      const validWin = { isDestroyed: () => false };
      expect(canFocus(validWin)).toBe(true);
    });
  });
});
