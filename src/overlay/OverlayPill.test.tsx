// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayFrame, OverlaySettings } from '../../electron/shared/overlay-types';
import { OverlayPill } from './OverlayPill';

const mocks = vi.hoisted(() => ({
  frameCb: null as ((frame: OverlayFrame) => void) | null,
  settingsCb: null as ((settings: OverlaySettings) => void) | null,
}));

beforeEach(() => {
  mocks.frameCb = null;
  mocks.settingsCb = null;
  Object.defineProperty(window, 'overlayAPI', {
    configurable: true,
    value: {
      onFrame: (cb: (frame: OverlayFrame) => void) => {
        mocks.frameCb = cb;
        return () => {};
      },
      onSettings: (cb: (settings: OverlaySettings) => void) => {
        mocks.settingsCb = cb;
        return () => {};
      },
    },
  });
});

describe('OverlayPill', () => {
  it('não mostra nada até receber o primeiro frame', () => {
    render(<OverlayPill />);
    expect(screen.queryByText('FPS')).toBeNull();
  });

  it('mostra o número em verde acima do alvo e em vermelho abaixo', () => {
    render(<OverlayPill />);
    act(() => mocks.frameCb?.({ fps: 120, color: 'good', visible: true }));
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByTestId('fps-value').className).toContain('good');

    act(() => mocks.frameCb?.({ fps: 45, color: 'bad', visible: true }));
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByTestId('fps-value').className).toContain('bad');
  });

  it('esconde quando o frame marca visible=false', () => {
    render(<OverlayPill />);
    act(() => mocks.frameCb?.({ fps: 60, color: 'good', visible: true }));
    expect(screen.getByText('60')).toBeTruthy();
    act(() => mocks.frameCb?.({ fps: 60, color: 'good', visible: false }));
    expect(screen.queryByText('60')).toBeNull();
  });

  it('aplica posição e opacidade vindas das configurações', () => {
    render(<OverlayPill />);
    act(() =>
      mocks.settingsCb?.({
        hotkey: 'Ctrl+Shift+F',
        position: 'bottom-right',
        opacity: 0.5,
        targetFps: 60,
        onlyWhenFocused: true,
      })
    );
    act(() => mocks.frameCb?.({ fps: 60, color: 'good', visible: true }));
    const pill = screen.getByTestId('overlay-pill');
    expect(pill.className).toContain('bottom-right');
    expect(pill.style.opacity).toBe('0.5');
  });
});
