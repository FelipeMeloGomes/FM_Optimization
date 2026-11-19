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
 * aviso da seção e alternar cada linha entre Executar e Cancelar. Se a
 * virtualização escondesse ou duplicasse linhas, o usuário veria scripts
 * errados no card sem nenhum erro de tipo — por isso o teste renderiza um
 * catálogo grande e confere que todas as linhas da seção aparecem.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
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
}: {
  section?: AppSection;
  scripts?: ScriptEntry[];
  activeExecution?: string | null;
} = {}) {
  const onCancel = vi.fn();
  const onConfirmExecute = vi.fn();
  const view = render(
    <VirtualizedSectionCard
      section={section}
      scripts={scripts}
      activeExecution={activeExecution}
      onCancel={onCancel}
      onConfirmExecute={onConfirmExecute}
    />
  );
  return { ...view, onCancel, onConfirmExecute };
}

beforeEach(() => {
  store.applied = new Set<string>();
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
    expect(screen.getAllByRole('button', { name: /Executar/ })).toHaveLength(40);
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

describe('VirtualizedSectionCard — ações', () => {
  it('usa "Executar novamente" no script já aplicado', () => {
    store.applied.add('apps-3');

    renderCard();

    expect(screen.getByRole('button', { name: /Executar novamente/ }).textContent).toContain(
      'Executar novamente'
    );
    expect(screen.getAllByRole('button', { name: /^Executar$/ })).toHaveLength(1);
  });

  it('chama onConfirmExecute com o script clicado', () => {
    const { onConfirmExecute } = renderCard({ scripts: [BLOAT] });

    fireEvent.click(screen.getByRole('button', { name: /Executar/ }));

    expect(onConfirmExecute).toHaveBeenCalledTimes(1);
    expect(onConfirmExecute).toHaveBeenCalledWith(BLOAT);
  });

  it('troca o botão por Cancelar no script em execução', () => {
    const { onCancel, onConfirmExecute } = renderCard({
      scripts: [BLOAT, BUILTIN],
      activeExecution: 'apps-3',
    });

    const cancelar = screen.getByRole('button', { name: /Cancelar/ });
    fireEvent.click(cancelar);

    expect(onCancel).toHaveBeenCalledWith('apps-3');
    expect(onConfirmExecute).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Executar$/ })).toHaveLength(1);
  });

  it('destaca o card quando algum script da seção está executando', () => {
    const { container } = renderCard({ activeExecution: 'builtin-14' });

    expect(container.firstElementChild?.className).toContain('ring-2 ring-primary/50');
  });

  it('não destaca o card quando a execução é de outra seção', () => {
    const { container } = renderCard({ activeExecution: 'apps-4' });

    expect(container.firstElementChild?.className).not.toContain('ring-2 ring-primary/50');
  });
});
