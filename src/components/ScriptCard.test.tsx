// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão do card individual de script.
 *
 * O botão precisa respeitar a opção "confirmar antes de executar": desligada,
 * dispara na hora; ligada, abre o diálogo e só executa no Confirmar. O card
 * também troca o botão por Cancelar durante a execução e só mostra o aviso de
 * reinício na transição executando → parado de um script que exige reinício.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
  confirmOnExecute: false,
}));

// Só a configuração é mockada: o card e o diálogo são os reais.
vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { confirmOnExecute: store.confirmOnExecute } }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

import { ScriptCard } from './ScriptCard';

function script(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id: 'cpu-1',
    name: 'Tweak de CPU',
    description: 'Ajusta o agendamento de threads.',
    category: 'CPU',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
    ...overrides,
  };
}

function setup(entry: ScriptEntry, isExecuting = false) {
  const onExecute = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <ScriptCard
      script={entry}
      isExecuting={isExecuting}
      onExecute={onExecute}
      onCancel={onCancel}
    />
  );

  function rerender(executing: boolean) {
    view.rerender(
      <ScriptCard
        script={entry}
        isExecuting={executing}
        onExecute={onExecute}
        onCancel={onCancel}
      />
    );
  }

  return { ...view, onExecute, onCancel, rerender };
}

beforeEach(() => {
  store.applied = new Set<string>();
  store.confirmOnExecute = false;
});

describe('ScriptCard — informações do script', () => {
  it('mostra nome, extensão e descrição', () => {
    setup(script());

    expect(screen.getByText('Tweak de CPU')).not.toBeNull();
    expect(screen.getByText('.ps1')).not.toBeNull();
    expect(screen.getByText('Ajusta o agendamento de threads.')).not.toBeNull();
  });

  it('mostra o aviso de administrador apenas quando exigido', () => {
    setup(script({ requiresAdmin: true }));

    expect(screen.getByText('Admin')).not.toBeNull();
    expect(screen.getByText('Requer administrador')).not.toBeNull();
  });

  it('mostra os avisos de reinício e de script interativo', () => {
    setup(script({ requiresRestart: true, interactive: true }));

    expect(screen.getByText('Reiniciar')).not.toBeNull();
    expect(screen.getByText('Requer reinício do PC após execução')).not.toBeNull();
    expect(screen.getByText('Interativo')).not.toBeNull();
    expect(
      screen.getByText('Script interativo — abrirá uma janela do CMD para inputs')
    ).not.toBeNull();
  });

  it('traduz o nível de risco', () => {
    setup(script({ riskLevel: 'deep' }));

    expect(screen.getByText('Completo')).not.toBeNull();
  });

  it('marca o script já aplicado', () => {
    store.applied.add('cpu-1');

    setup(script());

    expect(screen.getByText('Aplicado')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Executar novamente' })).not.toBeNull();
  });
});

describe('ScriptCard — confirmação de execução', () => {
  it('executa direto quando a confirmação está desligada', () => {
    const { onExecute } = setup(script());

    fireEvent.click(screen.getByRole('button', { name: 'Executar script' }));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Confirmar Execução')).toBeNull();
  });

  it('pede confirmação quando a opção está ligada', () => {
    store.confirmOnExecute = true;
    const { onExecute } = setup(script());

    fireEvent.click(screen.getByRole('button', { name: 'Executar script' }));

    expect(onExecute).not.toHaveBeenCalled();
    expect(screen.getByText('Confirmar Execução')).not.toBeNull();
    expect(
      within(screen.getByRole('dialog')).getByText('Ajusta o agendamento de threads.')
    ).not.toBeNull();
  });

  it('executa ao confirmar no diálogo', () => {
    store.confirmOnExecute = true;
    const { onExecute } = setup(script());

    fireEvent.click(screen.getByRole('button', { name: 'Executar script' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Confirmar Execução')).toBeNull();
  });

  it('cancelar no diálogo não executa', () => {
    store.confirmOnExecute = true;
    const { onExecute } = setup(script());

    fireEvent.click(screen.getByRole('button', { name: 'Executar script' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onExecute).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirmar Execução')).toBeNull();
  });

  it('avisa sobre o reinício no diálogo quando o script exige', () => {
    store.confirmOnExecute = true;
    setup(script({ requiresRestart: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Executar script' }));

    expect(
      screen.getByText('Este script requer reinício do PC para que as mudanças tenham efeito.')
    ).not.toBeNull();
  });
});

describe('ScriptCard — execução em andamento', () => {
  it('troca o botão por Cancelar e repassa o clique', () => {
    const { onCancel, onExecute } = setup(script(), true);

    const cancelar = screen.getByRole('button', { name: 'Cancelar execução' });
    fireEvent.click(cancelar);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onExecute).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Executar script' })).toBeNull();
  });

  it('avisa sobre o reinício quando a execução termina', () => {
    const { rerender } = setup(script({ requiresRestart: true }), true);

    rerender(false);

    expect(screen.getByText('Reinício necessário')).not.toBeNull();
    expect(screen.getByText('As mudanças só terão efeito após reiniciar o PC.')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));

    expect(screen.queryByText('Reinício necessário')).toBeNull();
  });

  it('não avisa sobre reinício quando o script não exige', () => {
    const { rerender } = setup(script(), true);

    rerender(false);

    expect(screen.queryByText('Reinício necessário')).toBeNull();
  });
});
