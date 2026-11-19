// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import KeyboardPage from './KeyboardPage';
import MonitorPage from './MonitorPage';
import MousePage from './MousePage';

const store = vi.hoisted(() => ({
  state: { status: 'success' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  page: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: (category: string) => {
    store.page(category);
    return {
      state: store.state,
      categoryScripts: store.scripts,
      activeExecution: null,
      handleExecute: () => {},
      handleCancel: () => {},
      handleConfirmExecute: () => {},
      confirmScript: null,
      setConfirmScript: () => {},
      handleConfirm: () => {},
    };
  },
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

const PAGES = [
  { Page: MousePage, category: 'Mouse', heading: 'Mouse' },
  { Page: MonitorPage, category: 'Monitor', heading: 'Monitor' },
  { Page: KeyboardPage, category: 'Teclado', heading: 'Teclado' },
] as const;

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = [];
  store.page.mockClear();
});

describe('páginas separadas dos periféricos', () => {
  it.each(PAGES)(
    '$heading tem página própria na categoria $category',
    async ({ Page, category, heading }) => {
      render(<Page />);

      await waitFor(() => expect(store.page).toHaveBeenCalledWith(category));
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeTruthy();
    }
  );

  it('cada página pede apenas a sua categoria', async () => {
    const { unmount } = render(<MousePage />);
    await waitFor(() => expect(store.page).toHaveBeenCalledWith('Mouse'));
    expect(store.page).toHaveBeenCalledTimes(1);
    unmount();

    render(<MonitorPage />);
    await waitFor(() => expect(store.page).toHaveBeenLastCalledWith('Monitor'));
    expect(store.page).toHaveBeenCalledTimes(2);
  });
});
