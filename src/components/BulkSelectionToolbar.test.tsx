// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkSelectionToolbar } from './BulkSelectionToolbar';

interface Item {
  id: string;
  name: string;
}

const item = (id: string, name = `Item ${id}`): Item => ({ id, name });

interface SetupProps {
  availableIds?: string[];
  selectedIds?: Set<string>;
  selectedItems?: Item[];
  onSelectAll?: () => void;
  onClear?: () => void;
  onApply?: (items: Item[]) => void;
  applying?: boolean;
  progress?: { index: number; total: number } | null;
  failedItems?: Item[];
  onDismissFailures?: () => void;
  applyLabel?: string;
  failureLabel?: (count: number) => string;
}

function setup(overrides: SetupProps = {}) {
  const props: Required<SetupProps> = {
    availableIds: ['a', 'b', 'c'],
    selectedIds: new Set<string>(),
    selectedItems: [],
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onApply: vi.fn(),
    applying: false,
    progress: null,
    failedItems: [],
    onDismissFailures: vi.fn(),
    applyLabel: 'Aplicar selecionados',
    failureLabel: (count) => (count === 1 ? 'Falhou o tweak' : 'Falharam os tweaks'),
    ...overrides,
  };

  const { container } = render(
    <BulkSelectionToolbar<Item>
      availableIds={props.availableIds}
      selectedIds={props.selectedIds}
      selectedItems={props.selectedItems}
      onSelectAll={props.onSelectAll}
      onClear={props.onClear}
      onApply={props.onApply}
      applying={props.applying}
      progress={props.progress}
      failedItems={props.failedItems}
      onDismissFailures={props.onDismissFailures}
      getItemId={(entry) => entry.id}
      getItemName={(entry) => entry.name}
      applyLabel={props.applyLabel}
      failureLabel={props.failureLabel}
    />
  );

  return { ...props, container };
}

function selectAllCheckbox(): HTMLInputElement {
  return screen.getByRole('checkbox', { name: /Selecionar todos/ }) as HTMLInputElement;
}

describe('BulkSelectionToolbar', () => {
  it('mostra o contador no label e dispara seleção de todos', () => {
    const props = setup();

    const checkbox = selectAllCheckbox();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.id).toBe('select-all-tweaks');
    expect(checkbox.closest('label')?.textContent).toContain('0 de 3 selecionados');
    expect(
      (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
    ).toBe(true);

    fireEvent.click(checkbox);
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('conta apenas itens visíveis e envia a seleção ao aplicar', () => {
    const first = item('a', 'Primeiro');
    const second = item('b', 'Segundo');
    const props = setup({ selectedIds: new Set(['a']), selectedItems: [first, second] });

    expect(selectAllCheckbox().closest('label')?.textContent).toContain('1 de 3 selecionados');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));
    expect(props.onApply).toHaveBeenCalledWith([first, second]);
  });

  it(' usa Limpar seleção quando tudo está marcado', () => {
    const props = setup({ selectedIds: new Set(['a', 'b', 'c']) });

    expect(selectAllCheckbox().checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('mostra progresso e desabilita o lote durante a aplicação', () => {
    const props = setup({
      applying: true,
      progress: { index: 2, total: 5 },
      selectedIds: new Set(['a']),
    });

    expect(screen.getByRole('status').textContent).toBe('2 de 5');
    expect((screen.getByRole('button', { name: 'Aplicando…' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('mostra falhas com nome do item e permite fechar', () => {
    const props = setup({
      failedItems: [item('b', 'Tweak do B')],
      applyLabel: 'Aplicar itens',
      failureLabel: (count) => (count === 1 ? 'Falhou o item' : 'Falharam os itens'),
    });

    expect(screen.getByRole('alert').textContent).toContain('Falhou o item');
    expect(screen.getByText('Tweak do B')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Aplicar itens' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onDismissFailures).toHaveBeenCalledTimes(1);
  });

  it('usa tokens do tema e nenhuma cor fixa', () => {
    const { container } = setup();

    expect(container.querySelector('.border-border')).not.toBeNull();
    expect(container.querySelector('.bg-card')).not.toBeNull();
    expect(container.querySelector('.accent-primary')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(container.innerHTML).not.toContain('text-black');
    expect(container.innerHTML).not.toContain('bg-white');
    expect(container.innerHTML).not.toContain('text-gray-');
  });
});
