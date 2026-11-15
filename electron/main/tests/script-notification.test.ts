import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEnded } from '../../shared/ipc-types';

/**
 * Com a janela destruída não existe renderer para mostrar o toast de fim de
 * script: sem notificação nativa o usuário fecha a janela, roda um tweak e não
 * recebe nenhum sinal de que terminou. O agendador tem o próprio anúncio, então
 * notificar aqui também duplicaria o aviso da limpeza automática.
 */

const mocks = vi.hoisted(() => ({
  isSupported: vi.fn(() => true),
  show: vi.fn(),
  created: [] as { title: string; body: string }[],
}));

vi.mock('electron', () => ({
  Notification: class {
    static isSupported = mocks.isSupported;
    constructor(options: { title: string; body: string }) {
      mocks.created.push(options);
    }
    show = mocks.show;
  },
}));

const { buildScriptEndedNotification, notifyScriptEnded } = await import(
  '../services/script-notification'
);

function ended(overrides: Partial<ScriptEnded> = {}): ScriptEnded {
  return {
    id: 'tweak-1',
    code: 0,
    scriptName: 'Desativar telemetria',
    trigger: 'manual',
    ...overrides,
  };
}

describe('buildScriptEndedNotification', () => {
  it('anuncia o sucesso com o nome do script', () => {
    expect(buildScriptEndedNotification(ended())).toEqual({
      title: 'Script concluído',
      body: 'Desativar telemetria',
    });
  });

  it('anuncia a falha junto do codigo de saida', () => {
    expect(buildScriptEndedNotification(ended({ code: 1 }))).toEqual({
      title: 'Script falhou',
      body: 'Desativar telemetria (código 1)',
    });
  });

  it('anuncia o cancelamento', () => {
    expect(buildScriptEndedNotification(ended({ code: null, cancelled: true }))).toEqual({
      title: 'Script cancelado',
      body: 'Desativar telemetria',
    });
  });

  it('nao chama de cancelado o desfecho desconhecido', () => {
    expect(buildScriptEndedNotification(ended({ code: null, cancelled: false }))).toEqual({
      title: 'Script finalizado',
      body: 'Desativar telemetria',
    });
  });

  it('cai no id quando o evento vem sem nome', () => {
    expect(buildScriptEndedNotification(ended({ scriptName: undefined }))).toEqual({
      title: 'Script concluído',
      body: 'tweak-1',
    });
  });

  it('cai no id quando o nome vem em branco', () => {
    expect(buildScriptEndedNotification(ended({ scriptName: '   ' }))).toEqual({
      title: 'Script concluído',
      body: 'tweak-1',
    });
  });

  it('nao notifica limpeza agendada, que ja tem anuncio proprio', () => {
    expect(buildScriptEndedNotification(ended({ trigger: 'scheduled' }))).toBeNull();
  });

  it('trata evento antigo sem trigger como manual', () => {
    expect(buildScriptEndedNotification(ended({ trigger: undefined }))).not.toBeNull();
  });
});

describe('notifyScriptEnded', () => {
  beforeEach(() => {
    mocks.isSupported.mockReset().mockReturnValue(true);
    mocks.show.mockReset();
    mocks.created.length = 0;
  });

  it('mostra a notificacao quando nenhuma janela recebeu o evento', () => {
    expect(notifyScriptEnded(ended(), false)).toBe(true);
    expect(mocks.created).toEqual([
      { title: 'Script concluído', body: 'Desativar telemetria', silent: false },
    ]);
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('nao mostra nada quando alguma janela recebeu o evento', () => {
    expect(notifyScriptEnded(ended(), true)).toBe(false);
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it('nao estoura quando o sistema nao suporta notificacoes', () => {
    mocks.isSupported.mockReturnValue(false);
    expect(notifyScriptEnded(ended(), false)).toBe(false);
    expect(mocks.show).not.toHaveBeenCalled();
    expect(mocks.created).toHaveLength(0);
  });

  it('nao notifica execucao agendada mesmo sem janela', () => {
    expect(notifyScriptEnded(ended({ trigger: 'scheduled' }), false)).toBe(false);
    expect(mocks.show).not.toHaveBeenCalled();
  });
});
