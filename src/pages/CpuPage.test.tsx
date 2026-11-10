import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  CpuInfo,
  CpuVendor,
  MemoryInfo,
  ScriptEntry,
} from '../../electron/shared/ipc-types';

/**
 * Regressão das regras de exibição da página Desempenho (`/cpu`).
 *
 * Só os hooks são mockados; o componente, o filtro da escada de RAM e a
 * montagem das seções são os reais. É o que liga o aviso de identificador
 * genérico, o "—" dos núcleos estimados e a seleção de script de RAM ao que o
 * usuário vê.
 */

const store = vi.hoisted(() => ({
  cpu: { status: 'loading' } as AsyncState<CpuInfo>,
  memory: { status: 'loading' } as AsyncState<MemoryInfo>,
  page: { status: 'success', data: [] } as AsyncState<ScriptEntry[]>,
  scripts: [] as ScriptEntry[],
  vendor: 'amd' as CpuVendor,
  isManual: false,
  setOverride: () => {},
  clearOverride: () => {},
}));

vi.mock('../contexts/SystemContext', () => ({
  useCpuContext: () => ({ state: store.cpu, refreshing: false, refresh: () => {} }),
  useMemoryContext: () => ({ state: store.memory, refreshing: false, refresh: () => {} }),
}));

vi.mock('../hooks/use-cpu-vendor', () => ({
  useCpuVendor: () => ({
    detected: store.vendor,
    effective: store.vendor,
    categories: ['CPU', 'GPU', 'Windows'],
    isManual: store.isManual,
    setOverride: store.setOverride,
    clearOverride: store.clearOverride,
  }),
}));

vi.mock('../hooks/use-script-page', () => ({
  useScriptPage: () => ({
    state: store.page,
    categoryScripts: store.scripts,
    activeExecution: null,
    handleExecute: () => {},
    handleCancel: () => {},
    handleConfirmExecute: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

// O tema instancia `Path2D` no topo do módulo (canvas não existe no node) e
// chega aqui por um dos componentes de card; o fundo não influencia a página.
vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import CpuPage from './CpuPage';

const CPU: CpuInfo = {
  model: 'AMD Ryzen 5 5500',
  rawModel: 'AMD Ryzen 5 5500 6-Core Processor',
  manufacturer: 'AuthenticAMD',
  vendor: 'amd',
  cores: 6,
  logicalProcessors: 12,
  architecture: 'x64',
  usage: 12,
  nameIsGeneric: false,
  coresEstimated: false,
};

const MEMORY: MemoryInfo = {
  total: '16 GB',
  used: '6 GB',
  free: '10 GB',
  type: 'DDR4',
  slots: 2,
  frequency: '3200 MHz',
};

function script(id: string, name: string, subcategory = ''): ScriptEntry {
  return {
    id,
    name,
    description: `${name} — descrição`,
    category: 'CPU',
    subcategory,
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

/** Texto visível, sem tags e sem os comentários que o SSR insere entre nós. */
function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Valor da célula que segue o rótulo na faixa de informações da CPU. */
function cell(html: string, label: string): string {
  const match = text(html).match(new RegExp(`${label} (\\S+)`));
  if (!match) throw new Error(`célula "${label}" não encontrada`);
  return match[1];
}

function render(): string {
  return renderToStaticMarkup(<CpuPage />);
}

beforeEach(() => {
  store.cpu = { status: 'success', data: CPU };
  store.memory = { status: 'success', data: MEMORY };
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.vendor = 'amd';
  store.isManual = false;
});

describe('CpuPage — estados', () => {
  it('mostra o esqueleto enquanto a CPU ou os scripts carregam', () => {
    store.cpu = { status: 'loading' };

    const html = render();

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Desempenho · AMD');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'falha ao ler scripts.json' };

    const html = text(render());

    expect(html).toContain('Erro ao carregar tweaks');
    expect(html).toContain('falha ao ler scripts.json');
  });
});

describe('CpuPage — identificador genérico', () => {
  it('avisa quando o BIOS só entregou o identificador genérico', () => {
    store.cpu = {
      status: 'success',
      data: { ...CPU, model: 'AMD (Família 25 · Modelo 80)', nameIsGeneric: true },
    };

    const html = text(render());

    expect(html).toContain('O BIOS informou apenas o identificador genérico.');
    expect(html).toContain('AMD (Família 25 · Modelo 80)');
  });

  it('não avisa quando o nome comercial foi resolvido', () => {
    expect(text(render())).not.toContain('identificador genérico');
  });
});

describe('CpuPage — núcleos estimados', () => {
  it('mostra a contagem quando o WMI informou os núcleos físicos', () => {
    expect(cell(render(), 'Núcleos')).toBe('6');
  });

  it('mostra "—" em vez de um número inventado', () => {
    store.cpu = { status: 'success', data: { ...CPU, coresEstimated: true } };

    expect(cell(render(), 'Núcleos')).toBe('—');
  });

  it('mostra "—" para todos os campos quando a leitura da CPU falha', () => {
    store.cpu = { status: 'error', error: 'WMI indisponível' };

    const html = render();

    expect(cell(html, 'Processador')).toBe('—');
    expect(cell(html, 'Núcleos')).toBe('—');
    expect(cell(html, 'Threads')).toBe('—');
    // A RAM não depende da CPU: continua sendo exibida.
    expect(cell(html, 'RAM')).toBe('16');
  });
});

describe('CpuPage — fabricante', () => {
  it('rotula a página com o fabricante detectado e não mostra o aviso', () => {
    const html = text(render());

    expect(html).toContain('Desempenho · AMD');
    expect(html).not.toContain('Processador não identificado');
  });

  it('oferece a seleção manual quando o fabricante é desconhecido', () => {
    store.vendor = 'unknown';

    const html = text(render());

    expect(html).toContain('Desempenho · AMD / Intel');
    expect(html).toContain('Processador não identificado');
    expect(html).toContain('Nenhum fabricante Intel ou AMD reconhecido em "AMD Ryzen 5 5500".');
  });

  it('mostra a faixa de seleção manual quando há override', () => {
    store.vendor = 'amd';
    store.isManual = true;

    const html = text(render());

    expect(html).toContain(
      'Seleção manual (AMD) — a detecção automática não reconheceu este processador.'
    );
    expect(html).toContain('Usar detecção automática');
  });
});

describe('CpuPage — escada de RAM', () => {
  const ram4 = script('cpu-30', 'Limite do svchost (4 GB)', 'RAM');
  const ram16 = script('cpu-34', 'Limite do svchost (16 GB)', 'RAM');
  const ram32 = script('cpu-35', 'Limite do svchost (32 GB)', 'RAM');
  const common = script('cpu-10', 'Ajuste comum de CPU');

  it('lista apenas o degrau que cobre a RAM instalada', () => {
    store.scripts = [ram4, ram16, ram32, common];

    const html = text(render());

    expect(html).toContain('Limite do svchost (16 GB)');
    expect(html).toContain('Ajuste comum de CPU');
    expect(html).not.toContain('Limite do svchost (4 GB)');
    expect(html).not.toContain('Limite do svchost (32 GB)');
  });

  it('esconde todos os degraus enquanto a RAM é desconhecida', () => {
    store.memory = { status: 'loading' };
    store.scripts = [ram4, ram16, ram32, common];

    const html = text(render());

    expect(html).not.toContain('Limite do svchost');
    expect(html).toContain('Ajuste comum de CPU');
  });
});
