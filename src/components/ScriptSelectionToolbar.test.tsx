// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { ScriptSelectionToolbar } from './ScriptSelectionToolbar';

/**
 * Barra de seleção de tweaks no padrão da Limpeza: checkbox "Selecionar todos"
 * com contador no mesmo label, botão "Limpar seleção" e botão de aplicar com
 * estado de progresso.
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

function selectAllCheckbox(): HTMLInputElement {
  return screen.getByRole('checkbox', { name: /Selecionar todos/ }) as HTMLInputElement;
}

describe('ScriptSelectionToolbar', () => {
  it('mostra o contador dentro do label do checkbox e aplicar desabilitado com zero', () => {
    const props = setup();

    const checkbox = selectAllCheckbox();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.id).toBe('select-all-tweaks');
    expect(checkbox.closest('label')?.textContent).toContain('0 de 3 selecionados');
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Limpar seleção' }) as HTMLButtonElement).disabled
    ).toBe(true);

    fireEvent.click(checkbox);
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('conta apenas a seleção visível e habilita aplicar com algo marcado', () => {
    setup({ selectedIds: new Set(['a']) });

    expect(selectAllCheckbox().closest('label')?.textContent).toContain('1 de 3 selecionados');
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('marca o checkbox e usa Limpar seleção quando tudo está selecionado', () => {
    const props = setup({ selectedIds: new Set(['a', 'b', 'c']) });

    expect(selectAllCheckbox().checked).toBe(true);
    expect(selectAllCheckbox().closest('label')?.textContent).toContain('3 de 3 selecionados');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('desabilita aplicar durante o lote, mostra progresso e Aplicando…', () => {
    const props = setup({
      applying: true,
      progress: { index: 2, total: 5 },
      selectedIds: new Set(['a']),
    });

    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.getByText('2 de 5')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Aplicando…' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('mostra alerta de falhas com o nome do script e fecha', () => {
    const props = setup({ failedScripts: [script('b', 'Tweak do B')] });

    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.getByText('Tweak do B')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onDismissFailures).toHaveBeenCalledTimes(1);
  });

  it('envia os scripts selecionados ao aplicar, inclusive sem falhas', () => {
    const a = script('a', 'Tweak A');
    const b = script('b', 'Tweak B');
    const props = setup({ selectedIds: new Set(['a', 'b']), selectedScripts: [a, b] });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith([a, b]);
  });
});
