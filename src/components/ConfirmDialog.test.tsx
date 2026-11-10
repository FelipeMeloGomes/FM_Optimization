// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão do diálogo de confirmação usado pelas páginas de scripts.
 *
 * O diálogo tem três fases e a transição depende do fim real da execução:
 * confirmar entra em "Executando...", e só quando `isExecuting` volta para
 * false ele mostra "Concluído" com o tempo. Reabrir precisa zerar a fase, senão
 * o próximo script herdaria o resumo do anterior.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id?: string }) =>
    script.id !== undefined && store.applied.has(script.id),
}));

// ConfirmDialog importa RISK_STYLES de ScriptCard, que puxa o SettingsContext e
// o BatmanBackground — `Path2D` não existe no jsdom.
vi.mock('./BatmanBackground', () => ({ BatmanBackground: () => null }));

import { ConfirmDialog } from './ConfirmDialog';

interface Item {
  id?: string;
  name: string;
  description: string;
  extension?: 'bat' | 'ps1' | 'reg' | 'exe' | 'cmd';
  requiresAdmin?: boolean;
  requiresRestart?: boolean;
  interactive?: boolean;
  riskLevel?: 'safe' | 'moderate' | 'deep';
}

const SCRIPT: Item = {
  id: 'cpu-1',
  name: 'Tweak de CPU',
  description: 'Ajusta o agendamento de threads.',
  extension: 'ps1',
};

function setup(script: Item | null = SCRIPT, open = true, isExecuting = false) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const view = render(
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      script={script}
      onConfirm={onConfirm}
      isExecuting={isExecuting}
    />
  );

  function rerender({
    nextOpen = open,
    nextExecuting = isExecuting,
  }: {
    nextOpen?: boolean;
    nextExecuting?: boolean;
  } = {}) {
    view.rerender(
      <ConfirmDialog
        open={nextOpen}
        onOpenChange={onOpenChange}
        script={script}
        onConfirm={onConfirm}
        isExecuting={nextExecuting}
      />
    );
  }

  return { ...view, onOpenChange, onConfirm, rerender };
}

/** Confirma e leva o diálogo até a fase "done". */
function runToCompletion(entry: Item = SCRIPT) {
  const view = setup(entry);
  fireEvent.click(screen.getByRole('button', { name: 'Executar' }));
  view.rerender({ nextExecuting: true });
  view.rerender({ nextExecuting: false });
  return view;
}

beforeEach(() => {
  store.applied = new Set<string>();
});

describe('ConfirmDialog — sem script', () => {
  it('não renderiza nada quando o script é nulo', () => {
    const { container } = setup(null);

    expect(container.innerHTML).toBe('');
  });
});

describe('ConfirmDialog — fase de confirmação', () => {
  it('mostra nome, descrição e extensão', () => {
    setup();

    expect(screen.getByText('Confirmar Execução')).not.toBeNull();
    expect(screen.getByText('Confirme a execução')).not.toBeNull();
    expect(screen.getByText('Tweak de CPU')).not.toBeNull();
    expect(screen.getByText('Ajusta o agendamento de threads.')).not.toBeNull();
    expect(screen.getByText('.ps1')).not.toBeNull();
  });

  it('mostra os selos do script', () => {
    setup({
      ...SCRIPT,
      requiresAdmin: true,
      requiresRestart: true,
      interactive: true,
      riskLevel: 'moderate',
    });

    expect(screen.getByText('Admin')).not.toBeNull();
    expect(screen.getByText('Reiniciar')).not.toBeNull();
    expect(screen.getByText('Interativo')).not.toBeNull();
    expect(screen.getByText('Moderado')).not.toBeNull();
  });

  it('mostra os avisos de admin, reinício e script interativo', () => {
    setup({ ...SCRIPT, requiresAdmin: true, requiresRestart: true, interactive: true });

    expect(screen.getByText('Requer privilégios de administrador.')).not.toBeNull();
    expect(screen.getByText('Requer reinício do PC após execução.')).not.toBeNull();
    expect(
      screen.getByText('Script interativo — uma janela do CMD será aberta para inputs.')
    ).not.toBeNull();
  });

  it('usa "Executar novamente" quando o script já foi aplicado', () => {
    store.applied.add('cpu-1');

    setup();

    expect(screen.getByRole('button', { name: /Executar novamente/ })).not.toBeNull();
  });

  it('cancelar apenas fecha o diálogo', () => {
    const { onOpenChange, onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirmar chama onConfirm e entra na fase de execução', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Executando...')).not.toBeNull();
    expect(screen.getByText('Script em execução')).not.toBeNull();
    expect(screen.getByText('Executando script')).not.toBeNull();
    expect(screen.getByText('Não feche esta janela')).not.toBeNull();
    // O botão de ação e o "X" do Radix compartilham o rótulo acessível.
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2);
  });
});

describe('ConfirmDialog — fim da execução', () => {
  it('mostra o resumo quando isExecuting volta para false', () => {
    runToCompletion();

    expect(screen.getByText('Concluído')).not.toBeNull();
    expect(screen.getByText('Finalizado em 0s')).not.toBeNull();
    expect(screen.getByText('Executado com sucesso')).not.toBeNull();
    expect(screen.getByText('Tempo: 0s')).not.toBeNull();
  });

  it('lembra de reiniciar apenas quando o script exige', () => {
    runToCompletion({ ...SCRIPT, requiresRestart: true });

    expect(screen.getByText('Reinicie o PC para aplicar as mudanças.')).not.toBeNull();
  });

  it('não mostra o lembrete de reinício em scripts que não exigem', () => {
    runToCompletion();

    expect(screen.queryByText('Reinicie o PC para aplicar as mudanças.')).toBeNull();
  });

  it('não conclui se a execução nunca começou', () => {
    const { rerender } = setup(SCRIPT, true, false);

    rerender({ nextExecuting: false });

    expect(screen.queryByText('Concluído')).toBeNull();
    expect(screen.getByText('Confirmar Execução')).not.toBeNull();
  });

  it('volta para a confirmação ao reabrir', () => {
    const view = runToCompletion();

    view.rerender({ nextOpen: false });
    view.rerender({ nextOpen: true });

    expect(screen.getByText('Confirmar Execução')).not.toBeNull();
    expect(screen.queryByText('Concluído')).toBeNull();
    expect(screen.queryByText('Executado com sucesso')).toBeNull();
  });
});
