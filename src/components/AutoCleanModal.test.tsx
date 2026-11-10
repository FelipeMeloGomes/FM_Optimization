// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutoCleanRunResult,
  AutoCleanSettings,
  AutoCleanStatus,
} from '../../electron/shared/ipc-types';

/**
 * Regressão da configuração da limpeza automática.
 *
 * O modal é a única superfície para agendar a limpeza: cada controle precisa
 * mandar o patch certo para `updateConfig`, o status precisa mostrar o próximo
 * horário real (ou "desativada"/"calculando…") e as pendências de admin só
 * podem sumir depois de uma confirmação explícita.
 */

const state = vi.hoisted(() => ({
  status: null as AutoCleanStatus | null,
  updateConfig: vi.fn(),
  runNow: vi.fn(
    async (_ids: string[]): Promise<AutoCleanRunResult> => ({
      ran: [],
      pending: [],
      failed: [],
    })
  ),
  runPending: vi.fn(
    async (): Promise<AutoCleanRunResult> => ({ ran: [], pending: [], failed: [] })
  ),
  discard: vi.fn(async (_ids: string[]) => {}),
  relaunchAsAdmin: vi.fn(async () => ({ launched: true, cancelled: false })),
}));

vi.mock('../contexts/AutoCleanContext', () => ({
  useAutoCleanContext: () => state,
}));

import { AutoCleanModal } from './AutoCleanModal';

function autoClean(overrides: Partial<AutoCleanSettings> = {}): AutoCleanSettings {
  return {
    enabled: true,
    cleaners: ['cleaner-1', 'cleaner-2'],
    frequency: 'daily',
    weekday: null,
    dayOfMonth: null,
    time: '03:00',
    runOnStartup: false,
    catchUp: true,
    lastRunAt: null,
    nextRunAt: null,
    pending: [],
    ...overrides,
  };
}

function statusOf(
  overrides: Partial<AutoCleanSettings> = {},
  extra: Partial<AutoCleanStatus> = {}
): AutoCleanStatus {
  return { settings: autoClean(overrides), isAdmin: false, running: false, ...extra };
}

function renderModal() {
  const onOpenChange = vi.fn();
  render(<AutoCleanModal open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

beforeEach(() => {
  state.status = null;
  state.updateConfig.mockClear();
  state.runNow.mockClear();
  state.runPending.mockClear();
  state.discard.mockClear();
  state.relaunchAsAdmin.mockClear();
});

describe('AutoCleanModal — status', () => {
  it('mostra carregamento enquanto o status não chega', () => {
    renderModal();

    expect(screen.getByText('Carregando…')).not.toBeNull();
    expect(screen.queryByText('Limpeza automática')).not.toBeNull();
  });

  it('mostra o próximo horário e o selo de admin', () => {
    const today = new Date();
    today.setHours(23, 59, 0, 0);
    state.status = statusOf({ nextRunAt: today.getTime() }, { isAdmin: true });

    renderModal();

    expect(screen.getByText('próxima hoje às 23:59')).not.toBeNull();
    expect(screen.getAllByText('admin')).toHaveLength(1);
    expect(screen.queryByText('sem admin')).toBeNull();
    expect(screen.queryByText('Reiniciar como admin')).toBeNull();
  });

  it('diz que a limpeza está desativada', () => {
    state.status = statusOf({ enabled: false });

    renderModal();

    expect(screen.getByText('desativada')).not.toBeNull();
    // O texto de ajuda do catch-up também contém "próxima abertura"; o status
    // real começa com "próxima " e não deve aparecer quando está desativada.
    expect(screen.queryByText(/^próxima /)).toBeNull();
  });

  it('diz que o próximo horário ainda está sendo calculado', () => {
    state.status = statusOf({ nextRunAt: null });

    renderModal();

    expect(screen.getByText('calculando…')).not.toBeNull();
  });

  it('lista as pendências de admin e permite descartá-las com confirmação', async () => {
    state.status = statusOf({ cleaners: ['cleaner-1', 'cleaner-3'], pending: ['cleaner-1'] });

    renderModal();

    expect(screen.getByText('1 limpeza(s) aguardando administrador')).not.toBeNull();
    expect(screen.getByLabelText('Descartar pendência de Limpeza Rápida')).not.toBeNull();
    expect(screen.getByText('sem admin')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar todas' }));
    expect(state.discard).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar descarte' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarte' }));
    await waitFor(() => expect(state.discard).toHaveBeenCalledWith(['cleaner-1']));
  });

  it('executa as pendências pelo botão do aviso', async () => {
    state.status = statusOf({ pending: ['cleaner-2'] });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Executar pendências' }));

    await waitFor(() => expect(state.runPending).toHaveBeenCalledTimes(1));
  });
});

describe('AutoCleanModal — seleção de limpezas', () => {
  it('adiciona e remove limpezas preservando a ordem do catálogo', () => {
    state.status = statusOf({ cleaners: ['cleaner-1', 'cleaner-3'] });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Limpeza Total/ }));
    expect(state.updateConfig).toHaveBeenCalledWith({
      cleaners: ['cleaner-1', 'cleaner-3', 'cleaner-4'],
    });

    fireEvent.click(screen.getByRole('button', { name: /Limpeza Rápida/ }));
    expect(state.updateConfig).toHaveBeenCalledWith({ cleaners: ['cleaner-3'] });
  });

  it('nunca deixa a seleção vazia', () => {
    state.status = statusOf({ cleaners: ['cleaner-3'] });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Limpeza de Navegadores/ }));

    expect(state.updateConfig).not.toHaveBeenCalled();
  });

  it('executa agora com as limpezas selecionadas', async () => {
    state.status = statusOf({ cleaners: ['cleaner-1', 'cleaner-2'] });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Executar agora' }));

    await waitFor(() => expect(state.runNow).toHaveBeenCalledWith(['cleaner-1', 'cleaner-2']));
  });

  it('trava os botões de execução enquanto a limpeza roda', () => {
    state.status = statusOf({}, { running: true, isAdmin: true });

    renderModal();

    const runNow = screen.getByRole('button', { name: /Executando…/ }) as HTMLButtonElement;
    expect(runNow.disabled).toBe(true);
  });
});

describe('AutoCleanModal — agendamento', () => {
  it('salva a ativação, a frequência e o horário', () => {
    state.status = statusOf();

    renderModal();

    fireEvent.click(screen.getByLabelText('Ativar limpeza automática'));
    expect(state.updateConfig).toHaveBeenCalledWith({ enabled: false });

    fireEvent.change(screen.getByLabelText('Frequência'), { target: { value: 'monthly' } });
    expect(state.updateConfig).toHaveBeenCalledWith({ frequency: 'monthly' });

    fireEvent.change(screen.getByLabelText('Horário'), { target: { value: '05:15' } });
    expect(state.updateConfig).toHaveBeenCalledWith({ time: '05:15' });
  });

  it('mostra o dia da semana só no modo semanal', () => {
    state.status = statusOf({ frequency: 'weekly', weekday: 2 });
    const { unmount } = render(<AutoCleanModal open onOpenChange={() => {}} />);

    expect((screen.getByLabelText('Dia da semana') as HTMLSelectElement).value).toBe('2');
    expect(screen.queryByLabelText('Dia do mês')).toBeNull();
    unmount();

    state.status = statusOf({ frequency: 'monthly', dayOfMonth: 10 });
    render(<AutoCleanModal open onOpenChange={() => {}} />);

    expect((screen.getByLabelText('Dia do mês') as HTMLSelectElement).value).toBe('10');
    expect(screen.queryByLabelText('Dia da semana')).toBeNull();
  });

  it('salva os toggles de inicialização e recuperação', () => {
    state.status = statusOf({ runOnStartup: false, catchUp: true });

    renderModal();

    fireEvent.click(screen.getByLabelText('Iniciar com o Windows'));
    expect(state.updateConfig).toHaveBeenCalledWith({ runOnStartup: true });

    fireEvent.click(screen.getByLabelText('Executar ao abrir se estiver atrasado'));
    expect(state.updateConfig).toHaveBeenCalledWith({ catchUp: false });
  });

  it('desativa os campos quando a limpeza está desligada', () => {
    state.status = statusOf({ enabled: false });

    renderModal();

    // O disabled vem do fieldset; o `.disabled` do controle em si continua
    // false, então a asserção olha para o ancestral que o React desabilita.
    const frequency = screen.getByLabelText('Frequência');
    const time = screen.getByLabelText('Horário');
    expect((frequency.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect((time.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  });
});

describe('AutoCleanModal — fechamento', () => {
  it('fecha pelo botão e avisa o pai', () => {
    state.status = statusOf();

    const onOpenChange = renderModal();

    // O "X" do Radix também se chama "Fechar"; o botão do rodapé vem antes no
    // DOM e é o que devolve o controle para quem abriu o modal.
    const [footerClose] = screen.getAllByRole('button', { name: 'Fechar' });
    fireEvent.click(footerClose);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('AutoCleanModal — ações do contexto', () => {
  it('aciona o reinício como admin quando não há pendências', async () => {
    state.status = statusOf({}, { isAdmin: false });

    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reiniciar como admin' }));
    });

    expect(state.relaunchAsAdmin).toHaveBeenCalledTimes(1);
  });
});
