// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import { MONITOR_PAGE, MOUSE_PAGE } from '../lib/device-pages';
import DevicePage from './DevicePage';

const store = vi.hoisted(() => ({
  state: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  activeExecution: null as string | null,
  applied: new Set<string>(),
  handleCancel: vi.fn(),
  handleConfirmExecute: vi.fn(),
  page: vi.fn(),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: (category: string) => {
    store.page(category);
    return {
      state: store.state,
      categoryScripts: store.scripts,
      activeExecution: store.activeExecution,
      handleExecute: () => {},
      handleCancel: store.handleCancel,
      handleConfirmExecute: store.handleConfirmExecute,
      confirmScript: null,
      setConfirmScript: () => {},
      handleConfirm: () => {},
    };
  },
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: `Descrição de ${name}`,
    category: '',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const MOUSE_SCRIPTS = [
  script('inputlag-2', 'Otimizar Mouse'),
  script('inputlag-11', 'Desabilitar Aceleração do Mouse'),
];
const MONITOR_SCRIPT = script('inputlag-3', 'Otimizar Monitor');

function bodyText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  store.state = { status: 'success', data: [] };
  store.scripts = MOUSE_SCRIPTS;
  store.activeExecution = null;
  store.applied = new Set();
  store.handleCancel.mockClear();
  store.handleConfirmExecute.mockClear();
  store.page.mockClear();
});

describe('DevicePage', () => {
  it('pede ao hook a categoria do periférico', async () => {
    render(<DevicePage config={MOUSE_PAGE} />);

    await waitFor(() => expect(store.page).toHaveBeenCalledWith('Mouse'));
  });

  it('mostra o título, o resumo e o selo Sistema no banner', async () => {
    render(<DevicePage config={MOUSE_PAGE} />);

    await waitFor(() => expect(bodyText()).toContain('Mouse'));
    const text = bodyText();

    expect(text).toContain('O que otimiza:');
    expect(screen.getByText('Sistema')).toBeTruthy();
    expect(text).toContain(MOUSE_PAGE.heroDescription);
    expect(text).not.toContain('Otimizações do Registro');
  });

  it('mostra a foto real do produto no banner', () => {
    render(<DevicePage config={MOUSE_PAGE} />);

    expect(
      screen.getByRole('img', { name: 'Mouse gamer Logitech PRO X SuperLight 2 Black' })
    ).toBeTruthy();
  });

  it('não mostra a quantidade de tweaks nos badges', () => {
    render(<DevicePage config={MOUSE_PAGE} />);

    expect(screen.queryByText(/\d+\s+tweaks/)).toBeNull();
  });

  it('abre a lista e executa o tweak escolhido', async () => {
    render(<DevicePage config={MOUSE_PAGE} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver tweaks' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Ver tweaks' }));

    expect(bodyText()).toContain('Otimizar Mouse');
    expect(bodyText()).toContain('Desabilitar Aceleração do Mouse');
    fireEvent.click(screen.getAllByRole('button', { name: 'Executar' })[0]);

    expect(store.handleConfirmExecute).toHaveBeenCalledWith(MOUSE_SCRIPTS[0]);
  });

  it('executa direto quando o periférico tem um único tweak', async () => {
    store.scripts = [MONITOR_SCRIPT];

    render(<DevicePage config={MONITOR_PAGE} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Executar' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Ver tweaks' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    expect(store.handleConfirmExecute).toHaveBeenCalledWith(MONITOR_SCRIPT);
  });

  it('cancela o tweak em execução pelo id', async () => {
    store.activeExecution = 'inputlag-2';

    render(<DevicePage config={MOUSE_PAGE} />);

    const cancel = await screen.findByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancel);

    expect(store.handleCancel).toHaveBeenCalledWith('inputlag-2');
  });

  it('mostra o erro devolvido pelo catálogo', async () => {
    store.state = { status: 'error', error: 'falha ao ler scripts.json' };

    render(<DevicePage config={MOUSE_PAGE} />);

    await waitFor(() => expect(bodyText()).toContain('Erro ao carregar tweaks'));
    expect(bodyText()).toContain('falha ao ler scripts.json');
  });
});
