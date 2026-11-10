// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, MemoryInfo, ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão da paleta de comandos (Ctrl+K).
 *
 * A busca precisa filtrar por nome e por categoria, a navegação por teclado
 * (setas + Enter) e por clique deve levar à rota da categoria, e a escada de RAM
 * só pode listar o degrau que cobre a memória instalada — mais o script de
 * reset, que fica sempre visível. Com a RAM desconhecida, nenhum degrau aparece.
 */

const store = vi.hoisted(() => ({
  scripts: { status: 'success', data: [] } as AsyncState<ScriptEntry[]>,
  filtered: [] as ScriptEntry[],
  memory: { status: 'loading' } as AsyncState<MemoryInfo>,
  navigate: vi.fn(),
  applied: new Set<string>(),
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({ state: store.scripts, filteredScripts: store.filtered }),
}));

vi.mock('../contexts/SystemContext', () => ({
  useMemoryContext: () => ({ state: store.memory }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => store.navigate };
});

// ScriptBadge (filho real) importa ScriptCard → SettingsContext → tema, e o
// BatmanBackground instancia `Path2D` no topo do módulo (não existe no jsdom).
vi.mock('./BatmanBackground', () => ({ BatmanBackground: () => null }));

import { CommandPalette } from './CommandPalette';

function script(id: string, name: string, category = 'CPU', subcategory = ''): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category,
    subcategory,
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

const MEMORY: MemoryInfo = {
  total: '16 GB',
  used: '6 GB',
  free: '10 GB',
  type: 'DDR4',
  slots: 2,
  frequency: '3200 MHz',
};

const CPU_TWEAK = script('cpu-1', 'Agendador de CPU');
const CLEANER = script('cleaner-1', 'Limpar Cache', 'Cleaner');
const RAM_4 = script('cpu-30', 'Limite do svchost (4 GB)', 'CPU', 'RAM');
const RAM_16 = script('cpu-34', 'Limite do svchost (16 GB)', 'CPU', 'RAM');
const RAM_RESET = script('cpu-37', 'Restaurar Limite do svchost', 'CPU', 'RAM');
const CPU_COMMON = script('cpu-10', 'Ajuste comum de CPU');

function setup(isOpen = true) {
  const onClose = vi.fn();
  const view = render(<CommandPalette isOpen={isOpen} onClose={onClose} />);
  return { ...view, onClose };
}

function openPalette() {
  return setup(true);
}

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Buscar tweaks...'), { target: { value } });
}

function results(): string[] {
  return screen.queryAllByRole('button').map((button) => button.textContent ?? '');
}

beforeEach(() => {
  store.scripts = { status: 'success', data: [] };
  store.filtered = [];
  store.memory = { status: 'success', data: MEMORY };
  store.navigate = vi.fn();
  store.applied = new Set<string>();
});

describe('CommandPalette — abertura', () => {
  it('não renderiza nada quando está fechada', () => {
    const { container } = setup(false);

    expect(container.innerHTML).toBe('');
  });

  it('mostra o campo de busca ao abrir', () => {
    openPalette();

    expect(screen.getByPlaceholderText('Buscar tweaks...')).not.toBeNull();
    expect(screen.getByText('ESC')).not.toBeNull();
  });
});

describe('CommandPalette — busca', () => {
  beforeEach(() => {
    store.scripts = { status: 'success', data: [CPU_TWEAK, CLEANER] };
    store.filtered = [CPU_TWEAK, CLEANER];
  });

  it('lista todos os scripts quando a busca está vazia', () => {
    openPalette();

    const text = results().join(' | ');
    expect(text).toContain('Agendador de CPU');
    expect(text).toContain('Limpar Cache');
  });

  it('filtra pelo nome sem diferenciar maiúsculas', () => {
    openPalette();

    type('AGENDADOR');

    expect(screen.getByText('Agendador de CPU')).not.toBeNull();
    expect(screen.queryByText('Limpar Cache')).toBeNull();
  });

  it('filtra pela categoria', () => {
    openPalette();

    type('cleaner');

    expect(screen.getByText('Limpar Cache')).not.toBeNull();
    expect(screen.queryByText('Agendador de CPU')).toBeNull();
  });

  it('mostra a mensagem de vazio quando nada casa', () => {
    openPalette();

    type('zzz');

    expect(screen.getByText('Nenhum resultado encontrado')).not.toBeNull();
    expect(screen.queryByText('Agendador de CPU')).toBeNull();
  });

  it('mostra a mensagem de vazio quando o catálogo falha', () => {
    store.scripts = { status: 'error', error: 'falha ao ler scripts.json' };
    store.filtered = [];

    openPalette();

    expect(screen.getByText('Nenhum resultado encontrado')).not.toBeNull();
  });

  it('limpa a busca ao reabrir', () => {
    const { rerender } = setup(true);

    type('agendador');
    rerender(<CommandPalette isOpen={false} onClose={() => {}} />);
    rerender(<CommandPalette isOpen onClose={() => {}} />);

    const input = screen.getByPlaceholderText('Buscar tweaks...') as HTMLInputElement;
    expect(input.value).toBe('');
  });
});

describe('CommandPalette — escada de RAM', () => {
  const SCRIPTS = [RAM_4, RAM_16, RAM_RESET, CPU_COMMON];

  beforeEach(() => {
    store.scripts = { status: 'success', data: SCRIPTS };
    store.filtered = SCRIPTS;
  });

  it('mostra apenas o degrau que cobre a RAM instalada', () => {
    openPalette();

    expect(screen.getByText('Limite do svchost (16 GB)')).not.toBeNull();
    expect(screen.queryByText('Limite do svchost (4 GB)')).toBeNull();
    expect(screen.getByText('Ajuste comum de CPU')).not.toBeNull();
  });

  it('mantém o script de reset sempre visível', () => {
    openPalette();

    expect(screen.getByText('Restaurar Limite do svchost')).not.toBeNull();
  });

  it('esconde todos os degraus quando a RAM é desconhecida', () => {
    store.memory = { status: 'loading' };

    openPalette();

    expect(screen.queryByText('Limite do svchost (16 GB)')).toBeNull();
    expect(screen.queryByText('Limite do svchost (4 GB)')).toBeNull();
    expect(screen.getByText('Restaurar Limite do svchost')).not.toBeNull();
    expect(screen.getByText('Ajuste comum de CPU')).not.toBeNull();
  });
});

describe('CommandPalette — navegação', () => {
  beforeEach(() => {
    store.scripts = { status: 'success', data: [CPU_TWEAK, CLEANER] };
    store.filtered = [CPU_TWEAK, CLEANER];
  });

  it('navega para a rota do script e fecha ao clicar', () => {
    const { onClose } = openPalette();

    fireEvent.click(screen.getByRole('button', { name: /Limpar Cache/ }));

    expect(store.navigate).toHaveBeenCalledWith('/cleaner');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navega para o primeiro resultado com Enter', () => {
    const { onClose } = openPalette();

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(store.navigate).toHaveBeenCalledWith('/cpu');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('move a seleção com as setas antes de abrir com Enter', () => {
    openPalette();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(store.navigate).toHaveBeenCalledWith('/cleaner');
  });

  it('mantém a seleção no primeiro item ao subir no topo', () => {
    openPalette();

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(store.navigate).toHaveBeenCalledWith('/cpu');
  });

  it('fecha com Escape', () => {
    const { onClose } = openPalette();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar no fundo', () => {
    const { onClose, container } = openPalette();

    const backdrop = container.querySelector('[aria-hidden="true"]');
    if (!backdrop) throw new Error('fundo da paleta não encontrado');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('não navega quando a busca não tem resultados', () => {
    openPalette();

    type('zzz');
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(store.navigate).not.toHaveBeenCalled();
  });
});
