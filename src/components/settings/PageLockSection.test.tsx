// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, PageLockSettings } from '../../../electron/shared/ipc-types';

/**
 * Regressão do Page Lock.
 *
 * A seção só pode alterar a lista de páginas bloqueadas depois que o main
 * confirma a senha, e a lista oferecida precisa sair de `ROUTES` (somente rotas
 * protegidas): bloquear `/history`, `/restore-points` ou `/settings` não teria
 * efeito porque essas rotas não passam pelo guard.
 */

const state = vi.hoisted(() => ({
  settings: {} as Partial<AppSettings>,
  update: vi.fn(),
  exportData: vi.fn(async () => {}),
  importData: vi.fn(async (_file: File) => {}),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: state.settings as AppSettings,
    update: state.update,
    loading: false,
    exportData: state.exportData,
    importData: state.importData,
  }),
}));

const api = {
  verifyPageLockPassword: vi.fn(async (_payload: { password: string }) => true),
  setPageLockPassword: vi.fn(async (_payload: { password: string }) => ({
    salt: 'salt-1',
    passwordHashCipher: 'hash-1',
  })),
};

beforeEach(() => {
  state.update.mockClear();
  api.verifyPageLockPassword.mockClear();
  api.setPageLockPassword.mockClear();
  api.verifyPageLockPassword.mockResolvedValue(true);
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

import { PageLockSection } from './PageLockSection';

function pageLock(overrides: Partial<PageLockSettings> = {}): PageLockSettings {
  return {
    enabled: true,
    salt: '',
    passwordHashCipher: '',
    lockedPages: ['/emuladores'],
    unlocked: false,
    ...overrides,
  };
}

function renderWith(overrides: Partial<PageLockSettings> = {}) {
  state.settings = { pageLock: pageLock(overrides) };
  return render(<PageLockSection />);
}

const REGISTERED = { salt: 'salt-1', passwordHashCipher: 'hash-1' };

describe('PageLockSection — cadastro de senha', () => {
  it('pede o cadastro quando ainda não há senha', () => {
    renderWith();

    expect(screen.getByText(/Cadastre uma senha/)).not.toBeNull();
    expect(screen.getByRole('button', { name: /Cadastrar senha/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
    expect(screen.getByText(/Paginas bloqueadas:/).textContent).toContain('emuladores');
  });

  it('recusa senha com menos de quatro caracteres sem chamar o main', async () => {
    renderWith();

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar senha'), { target: { value: 'abc' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cadastrar senha/ }));
    });

    expect(screen.getByText('A senha precisa de pelo menos 4 caracteres.')).not.toBeNull();
    expect(api.setPageLockPassword).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it('recusa confirmação diferente', async () => {
    renderWith();

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'abcd' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar senha'), { target: { value: 'abce' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cadastrar senha/ }));
    });

    expect(screen.getByText('As senhas nao coincidem.')).not.toBeNull();
    expect(api.setPageLockPassword).not.toHaveBeenCalled();
  });

  it('salva o salt e o hash devolvidos pelo main', async () => {
    renderWith();

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'abcd' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar senha'), { target: { value: 'abcd' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cadastrar senha/ }));
    });

    expect(api.setPageLockPassword).toHaveBeenCalledWith({ password: 'abcd' });
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        pageLock: { ...pageLock(), ...REGISTERED },
      })
    );
    expect(screen.queryByText('A senha precisa de pelo menos 4 caracteres.')).toBeNull();
  });
});

describe('PageLockSection — verificação de senha', () => {
  it('bloqueia o gerenciamento com senha incorreta', async () => {
    api.verifyPageLockPassword.mockResolvedValue(false);
    renderWith(REGISTERED);

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'errada' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });

    expect(api.verifyPageLockPassword).toHaveBeenCalledWith({ password: 'errada' });
    expect(screen.getByText('Senha incorreta.')).not.toBeNull();
    expect(state.update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Input Lag')).toBeNull();
  });

  it('libera a escolha das páginas após a senha correta', async () => {
    renderWith(REGISTERED);

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'segredo' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });

    await waitFor(() =>
      expect(screen.getByText('Escolha quais paginas ficam bloqueadas:')).not.toBeNull()
    );
    expect(screen.getByLabelText('Input Lag')).not.toBeNull();
    expect(screen.getByLabelText('Desempenho')).not.toBeNull();
    expect(screen.getByLabelText('Personalização')).not.toBeNull();
  });

  it('não oferece rotas sem guard nem páginas sempre visíveis', async () => {
    renderWith(REGISTERED);

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'segredo' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });

    await waitFor(() => expect(screen.getByLabelText('Input Lag')).not.toBeNull());

    expect(screen.queryByLabelText('Historico')).toBeNull();
    expect(screen.queryByLabelText('Restauracao')).toBeNull();
    expect(screen.queryByLabelText('Configuracoes')).toBeNull();
    expect(screen.queryByLabelText('Inicio')).toBeNull();
  });

  it('adiciona a rota protegida clicada à lista de bloqueio', async () => {
    renderWith(REGISTERED);

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'segredo' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });
    await waitFor(() => expect(screen.getByLabelText('Input Lag')).not.toBeNull());

    fireEvent.click(screen.getByLabelText('Input Lag'));

    expect(state.update).toHaveBeenCalledWith({
      pageLock: { ...pageLock(REGISTERED), lockedPages: ['/emuladores', '/input-lag'] },
    });
  });

  it('remove a rota já bloqueada ao desmarcar', async () => {
    renderWith({ ...REGISTERED, lockedPages: ['/emuladores', '/rede'] });

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'segredo' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });
    await waitFor(() => expect(screen.getByLabelText('Rede')).not.toBeNull());

    expect((screen.getByLabelText('Rede') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Rede'));

    expect(state.update).toHaveBeenCalledWith({
      pageLock: {
        ...pageLock({ ...REGISTERED, lockedPages: ['/emuladores', '/rede'] }),
        lockedPages: ['/emuladores'],
      },
    });
  });
});

describe('PageLockSection — revelar e bloquear', () => {
  it('revela as páginas depois da senha', async () => {
    renderWith(REGISTERED);

    fireEvent.change(screen.getByPlaceholderText('Digite sua senha para gerenciar/revelar'), {
      target: { value: 'segredo' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Revelar paginas bloqueadas/ })).not.toBeNull()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Revelar paginas bloqueadas/ }));
    });

    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        pageLock: expect.objectContaining({ unlocked: true }),
      })
    );
  });

  it('bloqueia novamente quando as páginas estão reveladas', () => {
    renderWith({ ...REGISTERED, unlocked: true });

    expect(screen.queryByText(/Paginas bloqueadas estao ocultas/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Bloquear novamente/ }));

    expect(state.update).toHaveBeenCalledWith({
      pageLock: { ...pageLock(REGISTERED), unlocked: false },
    });
  });

  it('desliga o bloqueio pelo toggle', () => {
    renderWith();

    fireEvent.click(screen.getByLabelText('Bloqueio de paginas'));

    expect(state.update).toHaveBeenCalledWith({
      pageLock: { ...pageLock(), enabled: false },
    });
  });
});
