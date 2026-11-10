// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  EssentialInstallProgress,
  EssentialInstallResult,
  EssentialListItem,
} from '../../electron/shared/ipc-types';

/**
 * Regressão da página App Essenciais PC: estados de carregamento/erro, herói,
 * lista de programas com ícone/nome/package, botão Instalar que chama
 * `install`, instalação em andamento com barra de progresso, erro por programa
 * e clique em Página oficial. `useEssentials` é mockado na fronteira.
 */

vi.mock('../hooks/use-essentials', () => ({
  useEssentials: () => store.essentials,
}));

import EssentialsPage from './EssentialsPage';

const store = vi.hoisted<{
  essentials: {
    state: AsyncState<EssentialListItem[]>;
    reload: ReturnType<typeof vi.fn>;
    installProgress: Record<string, EssentialInstallProgress>;
    installs: Record<string, EssentialInstallResult>;
    errors: Record<string, string>;
    running: Record<string, boolean>;
    install: ReturnType<typeof vi.fn>;
    cancelInstall: ReturnType<typeof vi.fn>;
    openPage: ReturnType<typeof vi.fn>;
  };
}>(() => ({
  essentials: {
    state: { status: 'loading' },
    reload: vi.fn(),
    installProgress: {},
    installs: {},
    errors: {},
    running: {},
    install: vi.fn(),
    cancelInstall: vi.fn(),
    openPage: vi.fn(),
  },
}));

const item: EssentialListItem = {
  id: 'cpu-z',
  name: 'CPU-Z',
  description: 'Informações detalhadas do processador, placa-mãe e memória.',
  packageId: 'CPUID.CPU-Z',
  pageUrl: 'https://cpuid.com/',
  warning: undefined,
};

function essentials(overrides: Partial<typeof store.essentials> = {}) {
  store.essentials = {
    state: { status: 'success', data: [item] },
    reload: vi.fn(),
    installProgress: {},
    installs: {},
    errors: {},
    running: {},
    install: vi.fn(),
    cancelInstall: vi.fn(),
    openPage: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  essentials();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EssentialsPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    essentials({ state: { status: 'loading' } });

    render(<EssentialsPage />);

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('App Essenciais PC')).toBeNull();
  });

  it('mostra o erro e o botão de tentar novamente', () => {
    essentials({ state: { status: 'error', error: 'winget não encontrado' } });

    render(<EssentialsPage />);

    expect(screen.getByText('Erro ao carregar os programas essenciais')).toBeDefined();
    expect(screen.getByText('winget não encontrado')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDefined();
  });
});

describe('EssentialsPage — conteúdo', () => {
  it('renderiza o herói e os programas', () => {
    render(<EssentialsPage />);

    expect(screen.getByText('App Essenciais PC')).toBeDefined();
    expect(screen.getByText('CPU-Z')).toBeDefined();
    expect(screen.getByText('CPUID.CPU-Z')).toBeDefined();
    expect(screen.getByText(/Informações detalhadas do processador/)).toBeDefined();
  });

  it('usa o ícone de fallback para programas desconhecidos', () => {
    essentials({
      state: {
        status: 'success',
        data: [{ ...item, id: 'desconhecido-xyz', name: 'Programa X', packageId: 'xyz.pkg' }],
      },
    });

    render(<EssentialsPage />);

    expect(screen.getByText('Programa X')).toBeDefined();
    expect(screen.getByText('xyz.pkg')).toBeDefined();
  });

  it('chama install ao clicar em Instalar', () => {
    const { install } = store.essentials;

    render(<EssentialsPage />);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Instalar' })));

    expect(install).toHaveBeenCalledWith(item);
  });

  it('mostra barra de progresso enquanto instala', () => {
    essentials({
      running: { 'cpu-z': true },
      installProgress: { 'cpu-z': { id: 'cpu-z', status: 'installing', percent: 45 } },
    });

    render(<EssentialsPage />);

    expect(screen.getByText('Instalando...')).toBeDefined();
    expect(screen.getByText('45%')).toBeDefined();
  });

  it('mostra Cancelar durante a instalação', () => {
    essentials({ running: { 'cpu-z': true } });

    render(<EssentialsPage />);

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();
  });

  it('mostra confirmação de instalação concluída', () => {
    essentials({
      installs: { 'cpu-z': { id: 'cpu-z', alreadyInstalled: false } },
    });

    render(<EssentialsPage />);

    expect(screen.getByText('Instalado pelo winget neste PC.')).toBeDefined();
  });

  it('mostra erro específico de um programa', () => {
    essentials({ errors: { 'cpu-z': 'hash do manifesto não confere' } });

    render(<EssentialsPage />);

    expect(screen.getByText('hash do manifesto não confere')).toBeDefined();
  });

  it('chama openPage ao clicar em Página oficial', () => {
    const { openPage } = store.essentials;

    render(<EssentialsPage />);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Página oficial' })));

    expect(openPage).toHaveBeenCalledWith(item);
  });
});
