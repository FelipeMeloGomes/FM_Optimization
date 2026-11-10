// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão dos controles da janela sem moldura.
 *
 * Minimizar e fechar são as únicas saídas do app quando a title bar nativa é
 * escondida; se o clique parar de chamar o IPC, a janela fica impossível de
 * fechar pelo mouse.
 */

const api = {
  minimizeWindow: vi.fn(async () => {}),
  closeWindow: vi.fn(async () => {}),
};

beforeEach(() => {
  api.minimizeWindow.mockClear();
  api.closeWindow.mockClear();
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

import { WindowControls } from './WindowControls';

describe('WindowControls', () => {
  it('minimiza a janela', () => {
    render(<WindowControls />);

    fireEvent.click(screen.getByLabelText('Minimizar'));

    expect(api.minimizeWindow).toHaveBeenCalledTimes(1);
    expect(api.closeWindow).not.toHaveBeenCalled();
  });

  it('fecha a janela', () => {
    render(<WindowControls />);

    fireEvent.click(screen.getByLabelText('Fechar'));

    expect(api.closeWindow).toHaveBeenCalledTimes(1);
    expect(api.minimizeWindow).not.toHaveBeenCalled();
  });

  it('mantém o layout base e aceita classe extra', () => {
    const { container } = render(<WindowControls className="ml-2" />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('flex')).toBe(true);
    expect(root.classList.contains('items-center')).toBe(true);
    expect(root.classList.contains('gap-0.5')).toBe(true);
    expect(root.classList.contains('ml-2')).toBe(true);
    expect(root.querySelectorAll('button')).toHaveLength(2);
  });
});
