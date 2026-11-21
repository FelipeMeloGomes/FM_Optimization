// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { ConfirmBulkScriptDialog } from './ConfirmBulkScriptDialog';

/**
 * Confirmação da aplicação em lote: lista os tweaks selecionados, avisa sobre
 * scripts interativos e só dispara a aplicação no botão explícito.
 */

function script(id: string, name: string): ScriptEntry {
  return {
    id,
    name,
    description: '',
    category: 'CPU',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

function setup(scripts: ScriptEntry[], onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <ConfirmBulkScriptDialog
      open
      onOpenChange={onOpenChange}
      scripts={scripts}
      onConfirm={onConfirm}
    />
  );

  return { onConfirm, onOpenChange };
}

describe('ConfirmBulkScriptDialog', () => {
  it('mostra o que será aplicado em sequência', () => {
    const { onConfirm } = setup([script('a', 'Primeiro tweak'), script('b', 'Segundo tweak')]);

    expect(screen.getByText('Confirmar aplicação')).not.toBeNull();
    expect(screen.getByText(/Os 2 tweaks abaixo serão aplicados em sequência/)).not.toBeNull();
    expect(screen.getByText('Primeiro tweak')).not.toBeNull();
    expect(screen.getByText('Segundo tweak')).not.toBeNull();
    expect(
      screen.getByText(/Scripts interativos abrem uma janela e só terminam quando você a fechar/)
    ).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('aplica o lote com o botão certo', () => {
    const { onConfirm } = setup([script('a', 'Primeiro tweak'), script('b', 'Segundo tweak')]);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar 2 tweaks' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('usa singular no botão para um único tweak', () => {
    const { onConfirm } = setup([script('a', 'Primeiro tweak')]);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar 1 tweak' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar fecha o diálogo sem confirmar', () => {
    const { onConfirm, onOpenChange } = setup([script('a', 'Primeiro tweak')]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
