// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import type { AppSection } from '../lib/app-sections';

/**
 * Regressão do card de seção (usado nas páginas Debloat/Utilitários).
 *
 * O card recebe o catálogo inteiro da categoria e precisa mostrar apenas os
 * scripts listados em `section.scriptIds` — inclusive na contagem de tweaks.
 * Um card que filtrasse errado exibiria scripts de outra seção e um total
 * inflado. Os botões também precisam alternar entre Executar e Cancelar
 * conforme `activeExecution`.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

// ScriptBadge (filho real) importa RISK_STYLES de ScriptCard, que puxa o tema e
// o BatmanBackground — `Path2D` não existe no jsdom.
vi.mock('./BatmanBackground', () => ({ BatmanBackground: () => null }));

import { ScriptSectionCard } from './ScriptSectionCard';

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
  color: 'text-red-400',
  bgColor: 'bg-red-500/10',
  borderColor: 'border-red-500/20',
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
    <ScriptSectionCard
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

describe('ScriptSectionCard — filtro por scriptIds', () => {
  it('lista só os scripts da seção e ignora o resto do catálogo', () => {
    renderCard();

    expect(screen.getByText('Remover Apps de Terceiros')).not.toBeNull();
    expect(screen.getByText('Remover Apps Nativos')).not.toBeNull();
    expect(screen.queryByText('Instalar Equicord')).toBeNull();
  });

  it('conta os tweaks pelo filtro, não pelo catálogo inteiro', () => {
    renderCard();

    expect(screen.getByText('2 tweaks').textContent).toBe('2 tweaks');
    expect(screen.queryByText('3 tweaks')).toBeNull();
  });

  it('mostra a seção vazia quando nenhum id do catálogo casa', () => {
    renderCard({ scripts: [OTHER] });

    expect(screen.getByText('0 tweaks').textContent).toBe('0 tweaks');
    expect(screen.queryByText('Instalar Equicord')).toBeNull();
  });

  it('mostra nome e descrição da seção', () => {
    renderCard();

    expect(screen.getByText(SECTION.description).textContent).toBe(SECTION.description);
  });
});

describe('ScriptSectionCard — aviso da seção', () => {
  it('mostra o aviso quando a seção declara um', () => {
    renderCard();

    expect(screen.getByText(SECTION.warning as string)).not.toBeNull();
  });

  it('esconde o bloco de aviso quando a seção não declara um', () => {
    renderCard({ section: { ...SECTION, warning: undefined } });

    expect(screen.queryByText(SECTION.warning as string)).toBeNull();
  });
});

describe('ScriptSectionCard — ações', () => {
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
