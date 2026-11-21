// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import type { AppSection, SectionIconName } from '../lib/app-sections';

/**
 * Regressão do card virtualizado (usado em Debloat/Privacidade/Personalização/
 * Otimização do Sistema).
 *
 * O componente é o substituto virtualizado do `ScriptSectionCard`, então ele
 * precisa manter o mesmo comportamento observável: filtrar o catálogo da
 * categoria por `section.scriptIds`, contar os tweaks pelo filtro, mostrar o
 * aviso da seção e manter `data-index` na linha medida. A linha trocou o botão
 * **Executar** por um checkbox de seleção (`aria-label "Selecionar <nome>"`)
 * que chama `onToggle(id)`; o botão **Cancelar** permanece só na linha em
 * execução. Não há mais botão `/Executar/` em nenhum estado.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

const virtual = vi.hoisted(() => ({
  calls: [] as { scrollRef: unknown; listRef: unknown }[],
}));

vi.mock('../hooks/use-virtual-rows', () => ({
  useVirtualRows: <T,>(items: T[], scrollRef: unknown, _rowHeight?: unknown, listRef?: unknown) => {
    virtual.calls.push({ scrollRef, listRef });
    return {
      virtualItems: items.map((_, index) => ({
        index,
        key: index,
        start: index * 88,
        end: (index + 1) * 88,
        size: 88,
        lane: 0,
      })),
      paddingTop: 0,
      paddingBottom: 0,
      measureElement: () => {},
    };
  },
}));

import { VirtualizedSectionCard } from './VirtualizedSectionCard';

function script(id: string, name: string, overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category: 'Debloat',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
    ...overrides,
  };
}

const SECTION: AppSection = {
  id: 'debloat',
  name: 'Remover Bloatware',
  description: 'Remova aplicativos desnecessários pré-instalados no Windows.',
  icon: 'trash',
  color: 'text-destructive',
  bgColor: 'bg-destructive/10',
  borderColor: 'border-destructive/20',
  scriptIds: ['apps-3', 'builtin-14'],
  warning: 'Alguns apps do sistema podem ser removidos. Use com cautela.',
};

const BLOAT = script('apps-3', 'Remover Apps de Terceiros');
const BUILTIN = script('builtin-14', 'Remover Apps Nativos');
const OTHER = script('apps-4', 'Instalar Equicord');

function renderCard({
  section = SECTION,
  scripts = [BLOAT, BUILTIN, OTHER],
  activeExecution = null,
  selectedIds = new Set<string>(),
  onToggle = vi.fn(),
  disabled = false,
}: {
  section?: AppSection;
  scripts?: ScriptEntry[];
  activeExecution?: string | null;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  disabled?: boolean;
} = {}) {
  const onCancel = vi.fn();
  const view = render(
    <VirtualizedSectionCard
      section={section}
      scripts={scripts}
      activeExecution={activeExecution}
      onCancel={onCancel}
      selectedIds={selectedIds}
      onToggle={onToggle}
      disabled={disabled}
    />
  );
  return { ...view, onCancel, onToggle };
}

beforeEach(() => {
  store.applied = new Set<string>();
  virtual.calls.length = 0;
});

describe('VirtualizedSectionCard — filtro por scriptIds', () => {
  it('lista só os scripts da seção e ignora o resto do catálogo', () => {
    renderCard();

    expect(screen.getByText('Remover Apps de Terceiros')).not.toBeNull();
    expect(screen.getByText('Remover Apps Nativos')).not.toBeNull();
    expect(screen.queryByText('Instalar Equicord')).toBeNull();

    const name = screen.getByText('Remover Apps de Terceiros');
    expect(name.getAttribute('title')).toBe('Remover Apps de Terceiros');
  });

  it('conta os tweaks pelo filtro, não pelo catálogo inteiro', () => {
    renderCard();

    expect(screen.getByText('2 tweaks').textContent).toBe('2 tweaks');
    expect(screen.queryByText('3 tweaks')).toBeNull();
  });

  it('mostra o card vazio quando nenhum id do catálogo casa', () => {
    renderCard({ scripts: [OTHER] });

    expect(screen.getByText('0 tweaks').textContent).toBe('0 tweaks');
    expect(screen.queryByText('Instalar Equicord')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /Executar/ })).toHaveLength(0);
  });

  it('renderiza a seção inteira mesmo com catálogo grande', () => {
    const many = Array.from({ length: 40 }, (_, i) => script(`apps-${i}`, `Tweak ${i}`));
    const section: AppSection = {
      ...SECTION,
      warning: undefined,
      scriptIds: many.map((s) => s.id),
    };

    renderCard({ section, scripts: many });

    expect(screen.getByText('40 tweaks').textContent).toBe('40 tweaks');
    expect(screen.getAllByRole('checkbox', { name: /Selecionar Tweak/ })).toHaveLength(40);
    expect(screen.queryByText('Tweak 39')).not.toBeNull();
    expect(screen.queryByText('Tweak 0')).not.toBeNull();
  });

  it('mostra nome e descrição da seção', () => {
    renderCard();

    expect(screen.getByText(SECTION.name).textContent).toBe(SECTION.name);
    expect(screen.getByText(SECTION.description).textContent).toBe(SECTION.description);
  });
});

describe('VirtualizedSectionCard — cabeçalho', () => {
  it.each([
    'shield',
    'trash',
    'discord',
    'music',
    'package',
    'monitor',
    'cpu',
    'sliders',
    'palette',
  ] as SectionIconName[])('renderiza o ícone "%s" sem quebrar', (icon) => {
    renderCard({ section: { ...SECTION, icon } });

    expect(screen.getByText(SECTION.name)).not.toBeNull();
  });
});

describe('VirtualizedSectionCard — aviso da seção', () => {
  it('mostra o aviso quando a seção declara um', () => {
    renderCard();

    expect(screen.getByText(SECTION.warning as string)).not.toBeNull();
  });

  it('esconde o bloco de aviso quando a seção não declara um', () => {
    renderCard({ section: { ...SECTION, warning: undefined } });

    expect(screen.queryByText(SECTION.warning as string)).toBeNull();
  });
});

describe('VirtualizedSectionCard — seleção por linha', () => {
  it('começa com o checkbox desmarcado e chama onToggle com o id ao clicar', () => {
    const { onToggle } = renderCard({ scripts: [BLOAT] });

    const check = screen.getByRole('checkbox', {
      name: 'Selecionar Remover Apps de Terceiros',
    });
    expect((check as HTMLInputElement).checked).toBe(false);

    fireEvent.click(check);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('apps-3');
  });

  it('marca o checkbox quando o id está em selectedIds', () => {
    const { container } = renderCard({
      scripts: [BLOAT],
      selectedIds: new Set(['apps-3']),
    });

    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Selecionar Remover Apps de Terceiros',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });

  it('desabilita o checkbox com disabled: true', () => {
    renderCard({
      scripts: [BLOAT],
      disabled: true,
    });

    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Selecionar Remover Apps de Terceiros',
        }) as HTMLInputElement
      ).disabled
    ).toBe(true);
  });

  it('não renderiza nenhum botão Executar', () => {
    renderCard({ scripts: [BLOAT, BUILTIN] });

    expect(screen.queryAllByRole('button', { name: /Executar/ })).toHaveLength(0);
  });

  it('mantém o Cancelar apenas na linha em execução e chama onCancel com o id', () => {
    const { onCancel } = renderCard({
      scripts: [BLOAT, BUILTIN],
      activeExecution: 'apps-3',
    });

    const cancelar = screen.getByRole('button', { name: /Cancelar/ });
    fireEvent.click(cancelar);

    expect(onCancel).toHaveBeenCalledWith('apps-3');
    expect(screen.queryAllByRole('button', { name: /^Executar$/ })).toHaveLength(0);
  });

  it('não mostra Cancelar quando nenhum script da seção está executando', () => {
    renderCard({ scripts: [BLOAT, BUILTIN] });

    expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull();
  });
});

describe('VirtualizedSectionCard — destaque de execução', () => {
  it('destaca o card quando algum script da seção está executando', () => {
    const { container } = renderCard({ activeExecution: 'builtin-14' });

    expect(container.firstElementChild?.className).toContain('ring-2 ring-primary/50');
  });

  it('não destaca o card quando a execução é de outra seção', () => {
    const { container } = renderCard({ activeExecution: 'apps-4' });

    expect(container.firstElementChild?.className).not.toContain('ring-2 ring-primary/50');
  });
});

describe('VirtualizedSectionCard — rolagem da página', () => {
  it('usa a rolagem da página em vez de um container de scroll próprio', () => {
    const { container } = renderCard();

    expect(virtual.calls).toHaveLength(1);
    expect(virtual.calls[0].scrollRef).toBeNull();
    expect(virtual.calls[0].listRef).not.toBeNull();

    const styled = Array.from(container.querySelectorAll<HTMLElement>('[style]'));
    expect(styled.some((el) => el.style.maxHeight === 'none')).toBe(false);
    expect(styled.some((el) => el.style.height === 'auto')).toBe(false);
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('expõe data-index na linha medida para o virtualizador não reclamar', () => {
    renderCard();

    const name = screen.getByText('Remover Apps de Terceiros');
    const row = name.closest('[data-index]');
    expect(row?.getAttribute('data-index')).toBe('0');
  });
});
