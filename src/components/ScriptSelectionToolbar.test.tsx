// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { ScriptSelectionToolbar } from './ScriptSelectionToolbar';

/**
 * Barra de seleção de tweaks: contador da seleção visível, botão
 * "Selecionar todos"/"Limpar seleção", botão "Aplicar selecionados" (desabilitado
 * com zero selecionados ou com o lote em andamento) e alerta de falhas.
 */

function script(id: string, name = `Script ${id}`): ScriptEntry {
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

interface SetupProps {
  availableIds?: string[];
  selectedIds?: Set<string>;
  selectedScripts?: ScriptEntry[];
  onSelectAll?: () => void;
  onClear?: () => void;
  onApply?: (scripts: ScriptEntry[]) => void;
  applying?: boolean;
  progress?: { index: number; total: number } | null;
  failedScripts?: ScriptEntry[];
  onDismissFailures?: () => void;
}

function setup(overrides: SetupProps = {}) {
  const props: Required<SetupProps> = {
    availableIds: ['a', 'b', 'c'],
    selectedIds: new Set<string>(),
    selectedScripts: [],
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onApply: vi.fn(),
    applying: false,
    progress: null,
    failedScripts: [],
    onDismissFailures: vi.fn(),
    ...overrides,
  };

  render(
    <ScriptSelectionToolbar
      availableIds={props.availableIds}
      selectedIds={props.selectedIds}
      selectedScripts={props.selectedScripts}
      onSelectAll={props.onSelectAll}
      onClear={props.onClear}
      onApply={props.onApply}
      applying={props.applying}
      progress={props.progress}
      failedScripts={props.failedScripts}
      onDismissFailures={props.onDismissFailures}
    />
  );

  return props;
}

describe('ScriptSelectionToolbar', () => {
  it('mostra contador zerado, aplicar desabilitado e selecionar todos marca', () => {
    const props = setup();

    expect(screen.getByText('0 de 3 selecionados')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Selecionar todos' })).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('conta apenas a seleção visível e habilita aplicar com algo marcado', () => {
    setup({ selectedIds: new Set(['a']) });

    expect(screen.getByText('1 de 3 selecionados')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('mostra Limpar seleção e habilita aplicar quando tudo está selecionado', () => {
    const props = setup({ selectedIds: new Set(['a', 'b', 'c']) });

    expect(screen.getByText('3 de 3 selecionados')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Limpar seleção' })).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('desabilita aplicar durante o lote com progresso', () => {
    const props = setup({
      applying: true,
      progress: { index: 2, total: 5 },
      selectedIds: new Set(['a']),
    });

    const status = screen.getByRole('status');
    expect(status).not.toBeNull();
    expect(screen.getByText('2 de 5')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('mostra alerta de falhas com o nome do script e fecha', () => {
    const props = setup({ failedScripts: [script('b', 'Tweak do B')] });

    const alert = screen.getByRole('alert');
    expect(alert).not.toBeNull();
    expect(screen.getByText('Tweak do B')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onDismissFailures).toHaveBeenCalledTimes(1);
  });

  it('envia os scripts selecionados ao aplicar, inclusive sem falhas', () => {
    const a = script('a', 'Tweak A');
    const b = script('b', 'Tweak B');
    const props = setup({
      selectedIds: new Set(['a', 'b']),
      selectedScripts: [a, b],
    });

    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith([a, b]);
  });
});
