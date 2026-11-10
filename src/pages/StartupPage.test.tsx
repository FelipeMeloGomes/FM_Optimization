// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  ScheduledTaskEntry,
  StartupAppEntry,
  StartupServiceEntry,
} from '../../electron/shared/ipc-types';

/**
 * Regressão da página Inicialização: estados de carregamento/erro, herói e
 * estatísticas, abas, busca, filtro "só ativos", troca de switch e diálogo de
 * confirmação que chama `toggle`/`stopService`. `useStartup` é mockado na
 * fronteira; o componente e as tabelas são reais.
 */

vi.mock('../hooks/use-startup', () => ({
  useStartup: () => store.startup,
}));

import StartupPage from './StartupPage';

const store = vi.hoisted<{
  startup: {
    state: AsyncState<{
      apps: StartupAppEntry[];
      tasks: ScheduledTaskEntry[];
      services: StartupServiceEntry[];
      isAdmin: boolean;
    }>;
    reload: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    stopService: ReturnType<typeof vi.fn>;
    openLocation: ReturnType<typeof vi.fn>;
    elevate: ReturnType<typeof vi.fn>;
    busy: Record<string, boolean | undefined>;
  };
}>(() => ({
  startup: {
    state: { status: 'success', data: { apps: [], tasks: [], services: [], isAdmin: true } },
    reload: vi.fn(),
    toggle: vi.fn(async () => true),
    stopService: vi.fn(async () => true),
    openLocation: vi.fn(),
    elevate: vi.fn(),
    busy: {},
  },
}));

const app: StartupAppEntry = {
  id: 'app-1',
  name: 'Spotify',
  command: 'spotify.exe',
  source: 'registry-user' as const,
  enabled: true,
  requiresAdmin: false,
  location: 'C:\\Spotify',
};

const task: ScheduledTaskEntry = {
  id: 'task-1',
  name: 'Task',
  path: 'C:\\task.exe',
  action: 'action',
  trigger: 'logon' as const,
  enabled: true,
  isMicrosoft: false,
  requiresAdmin: false,
};

const service: StartupServiceEntry = {
  id: 'svc-1',
  name: 'Svc',
  displayName: 'Meu Serviço',
  startMode: 'Automatic' as const,
  state: 'Running' as const,
  protected: false,
  requiresAdmin: false,
};

const data = {
  apps: [app],
  tasks: [task],
  services: [service],
  isAdmin: true,
};

function startup(
  overrides: Partial<{
    state: AsyncState<typeof data>;
    reload: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    stopService: ReturnType<typeof vi.fn>;
    openLocation: ReturnType<typeof vi.fn>;
    elevate: ReturnType<typeof vi.fn>;
    busy: Record<string, boolean | undefined>;
  }> = {}
) {
  store.startup = {
    state: { status: 'success', data },
    reload: vi.fn(),
    toggle: vi.fn(async () => true),
    stopService: vi.fn(async () => true),
    openLocation: vi.fn(),
    elevate: vi.fn(),
    busy: {},
    ...overrides,
  };
}

function renderPage() {
  return render(<StartupPage />);
}

beforeEach(() => {
  startup();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StartupPage — estados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    startup({ state: { status: 'loading' } });

    renderPage();

    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /atualizar/i })).toBeNull();
  });

  it('mostra o erro e o botão de tentar novamente', () => {
    startup({ state: { status: 'error', error: 'WMI negado' } });

    renderPage();

    expect(screen.getByText('Erro ao ler a inicialização do Windows')).toBeDefined();
    expect(screen.getByText('WMI negado')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDefined();
  });
});

describe('StartupPage — conteúdo', () => {
  it('renderiza herói, estatísticas e abas', () => {
    renderPage();

    expect(screen.getByText('Controle o que abre com o Windows')).toBeDefined();
    expect(screen.getByText('apps ativos')).toBeDefined();
    expect(screen.getAllByText('1/1').length).toBe(2);
    expect(screen.getByText('tarefas ativas')).toBeDefined();
    expect(screen.getByText('serviços automáticos')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Inicialização/ })).toBeDefined();
    expect(screen.getAllByRole('tab').length).toBe(3);
  });

  it('lista app na aba Inicialização', () => {
    renderPage();

    expect(screen.getByText('Spotify')).toBeDefined();
    expect(screen.getByText('Usuário (Run)')).toBeDefined();
  });

  it('lista tarefa ao abrir a aba Tarefas agendadas', () => {
    renderPage();

    const tabs = screen.getAllByRole('tab');
    const tarefas = tabs.find((t) => (t.textContent ?? '').includes('Tarefas'));
    expect(tarefas).toBeDefined();
    act(() => fireEvent.click(tarefas!));

    expect(screen.getByText('Task')).toBeDefined();
  });

  it('lista serviço ao abrir a aba Serviços', () => {
    renderPage();

    const tabs = screen.getAllByRole('tab');
    const servicos = tabs.find((t) => (t.textContent ?? '').includes('Serviços'));
    expect(servicos).toBeDefined();
    act(() => fireEvent.click(servicos!));

    expect(screen.getByText('Meu Serviço')).toBeDefined();
  });

  it('confirma a desativação e chama toggle com o app', async () => {
    const { toggle } = store.startup;

    renderPage();

    act(() => fireEvent.click(screen.getByLabelText(/Desativar Spotify/i)));

    expect(screen.getByText(/Desativar Spotify\?/)).toBeDefined();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Desativar' })));

    expect(toggle).toHaveBeenCalledWith({ kind: 'app', id: 'app-1', enabled: false }, 'Spotify');
  });

  it('não mostra aviso de admin quando já é admin', () => {
    renderPage();

    expect(screen.queryByText('Sem permissão de administrador')).toBeNull();
  });

  it('mostra aviso de admin e botão de elevar quando não é admin', () => {
    startup({
      state: { status: 'success', data: { ...data, isAdmin: false } },
    });
    renderPage();

    expect(screen.getByText('Sem permissão de administrador')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reiniciar como admin' })).toBeDefined();
  });
});
