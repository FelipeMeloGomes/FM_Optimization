import { describe, expect, it } from 'vitest';
import type { ExecutionHistoryEntry, ScriptEnded } from '../../shared/ipc-types';
import { reportInteractiveOpen } from '../services/script-outcome';

const NOW = 1_700_000_000_000;

function collect() {
  const notifications: ScriptEnded[] = [];
  const history: ExecutionHistoryEntry[] = [];
  const audits: Array<{ exitCode: number | null; success: boolean }> = [];

  return {
    notifications,
    history,
    audits,
    deps: {
      notify: (data: ScriptEnded) => notifications.push(data),
      recordHistory: (entry: ExecutionHistoryEntry) => history.push(entry),
      audit: (exitCode: number | null, success: boolean) => audits.push({ exitCode, success }),
      now: () => NOW,
    },
  };
}

describe('reportInteractiveOpen', () => {
  it('nao anuncia sucesso quando a janela apenas abriu', () => {
    const { notifications, deps } = collect();

    reportInteractiveOpen({ id: 'apps-2', scriptName: 'Seguranca', trigger: 'manual' }, deps);

    expect(notifications).toEqual([
      { id: 'apps-2', code: null, scriptName: 'Seguranca', trigger: 'manual' },
    ]);
  });

  it('grava historico com desfecho desconhecido em vez de exitCode 0', () => {
    const { history, deps } = collect();

    reportInteractiveOpen({ id: 'apps-2', scriptName: 'Seguranca', trigger: 'manual' }, deps);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: `apps-2_${NOW}`,
      scriptId: 'apps-2',
      scriptName: 'Seguranca',
      exitCode: null,
      wasCancelled: false,
      durationMs: 0,
      trigger: 'manual',
    });
  });

  it('usa o id como nome quando o script nao tem nome', () => {
    const { history, deps } = collect();

    reportInteractiveOpen({ id: 'dns-1', trigger: 'manual' }, deps);

    expect(history[0].scriptName).toBe('dns-1');
  });

  it('registra na auditoria que o resultado e desconhecido', () => {
    const { audits, deps } = collect();

    reportInteractiveOpen({ id: 'apps-2', scriptName: 'Seguranca', trigger: 'scheduled' }, deps);

    expect(audits).toEqual([{ exitCode: null, success: false }]);
  });
});
