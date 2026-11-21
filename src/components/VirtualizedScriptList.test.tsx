// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

const virtual = vi.hoisted(() => ({
  calls: [] as { scrollRef: unknown; rowHeight: unknown; listRef: unknown }[],
}));

vi.mock('../hooks/use-virtual-rows', () => ({
  useVirtualRows: <T,>(items: T[], scrollRef: unknown, rowHeight?: unknown, listRef?: unknown) => {
    virtual.calls.push({ scrollRef, rowHeight, listRef });
    return {
      virtualItems: items.map((_, index) => ({ index, key: index, size: 69 })),
      paddingTop: 69,
      paddingBottom: 138,
      measureElement: () => {},
    };
  },
}));

import { VirtualizedScriptList } from './VirtualizedScriptList';

function script(id: string, name: string, overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
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

const A = script('a', 'Tweak A');
const B = script('b', 'Tweak B');

function renderList({
  scripts = [A, B],
  activeExecution = null,
  selectedIds = new Set<string>(),
  onToggle = vi.fn(),
  disabled = false,
  labels,
}: {
  scripts?: ScriptEntry[];
  activeExecution?: string | null;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  disabled?: boolean;
  labels?: Record<string, { name: string; description: string }>;
} = {}) {
  const onCancel = vi.fn();
  const view = render(
    <VirtualizedScriptList
      scripts={scripts}
      activeExecution={activeExecution}
      onCancel={onCancel}
      selectedIds={selectedIds}
      onToggle={onToggle}
      disabled={disabled}
      labels={labels}
    />
  );
  return { ...view, onCancel, onToggle };
}

beforeEach(() => {
  virtual.calls.length = 0;
});

describe('VirtualizedScriptList — padrão da Limpeza', () => {
  it('renderiza uma lista única com divide-y, spacers e data-index', () => {
    renderList();

    const list = screen.getByTestId('tweaks-list');
    expect(list.querySelector('ul')?.className).toContain('divide-y');
    expect(screen.getByTestId('virtual-spacer-top').style.height).toBe('69px');
    expect(screen.getByTestId('virtual-spacer-bottom').style.height).toBe('138px');
    expect(list.querySelectorAll('li[data-index]')).toHaveLength(2);
    expect(list.querySelector('li[data-index]')?.getAttribute('data-index')).toBe('0');

    expect(virtual.calls).toHaveLength(1);
    expect(virtual.calls[0]?.scrollRef).toBeNull();
    expect(virtual.calls[0]?.rowHeight).toBe(69);
    expect(virtual.calls[0]?.listRef).not.toBeNull();
  });

  it('usa checkbox com id, rótulo acessível e acento por linha', () => {
    const props = renderList({ selectedIds: new Set(['a']) });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Selecionar Tweak A',
    }) as HTMLInputElement;
    expect(checkbox.id).toBe('tweak-item-a');
    expect(checkbox.className).toContain('accent-primary');
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(props.onToggle).toHaveBeenCalledWith('a');
  });

  it('alterna a seleção ao clicar no nome da linha', () => {
    const props = renderList();

    fireEvent.click(screen.getByText('Tweak B'));
    expect(props.onToggle).toHaveBeenCalledWith('b');
  });

  it('mostra Cancelar e desabilita o checkbox da linha em execução', () => {
    const props = renderList({ activeExecution: 'a' });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Selecionar Tweak A',
    }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalledWith('a');
  });

  it('usa nome e descrição do registry quando labels é informado', () => {
    renderList({ labels: { a: { name: 'Nome curado', description: 'Descrição curada' } } });

    expect(screen.getByText('Nome curado')).not.toBeNull();
    expect(screen.getByText('Descrição curada')).not.toBeNull();
    expect(screen.queryByText('Tweak A')).toBeNull();
  });

  it('desabilita todos os checkboxes enquanto o lote está em andamento', () => {
    renderList({ disabled: true });

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => checkbox.disabled)).toBe(true);
  });
});
