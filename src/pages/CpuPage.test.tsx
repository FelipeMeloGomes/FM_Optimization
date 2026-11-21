// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
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
 * Regressão das regras de exibição da página Otimização do Sistema (`/cpu`).
 *
 * Só os hooks são mockados; o componente, o filtro da escada de RAM e a
 * montagem das seções são os reais. É o que liga o aviso de identificador
 * genérico, o "—" dos núcleos estimados e a seleção de script de RAM ao que o
 * usuário vê.
 *
 * A página agora usa seleção múltipla: `use-script-page` expõe a API de lote
 * (`handleApply`, `batch`, …) e o hook de seleção é o real (não mockado).
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
  handleApply: vi.fn(),
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
    handleApply: store.handleApply,
    batch: null,
    confirmBulkScripts: [],
    setConfirmBulkScripts: () => {},
    handleConfirmBulk: () => {},
    failedScripts: [],
    clearFailures: () => {},
    confirmScript: null,
    setConfirmScript: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => () => false,
}));

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

function script(id: string, name: string, subcategory = '', category = 'CPU'): ScriptEntry {
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

/**
 * Texto de uma seção, ancorado no título seguido da descrição (o título sozinho
 * também aparece no nome de um script quando a página está com o bug de
 * duplicação).
 */
const PROCESSADOR = 'Processador Ajustes de processador que valem';
const GPU_AMD = 'GPU AMD Reduz o frame pre-renderizado';
const WINDOWS = 'Windows e energia Energia, serviços, prioridade';

function sectionText(html: string, anchor: string, nextAnchor?: string): string {
  const all = text(html);
  const from = all.indexOf(anchor);
  if (from < 0) throw new Error(`seção "${anchor}" não encontrada`);
  const to = nextAnchor ? all.indexOf(nextAnchor, from + anchor.length) : all.length;
  return all.slice(from, to < 0 ? all.length : to);
}

/** Classes do contêiner do hero (primeiro elemento com o gradiente do banner). */
function heroShell(html: string): string {
  const match = html.match(/<div class="([^"]*bg-gradient-to-br[^"]*)"/);
  if (!match) throw new Error('hero banner não encontrado');
  return match[1];
}

/** Classes do SVG animado dentro do hero (o ícone que deve seguir o tema). */
function heroIconClass(html: string): string {
  const start = html.indexOf('data-hero-animation');
  if (start < 0) throw new Error('ícone do hero não encontrado');
  const svg = html.slice(start).match(/<svg[^>]*class="([^"]+)"/);
  if (!svg) throw new Error('ícone do hero não encontrado');
  return svg[1];
}

/** Valor da célula que segue o rótulo na faixa de informações da CPU. */
function cell(html: string, label: string): string {
  const match = text(html).match(new RegExp(`${label} (\\S+)`));
  if (!match) throw new Error(`célula "${label}" não encontrada`);
  return match[1];
}

function renderStatic(): string {
  return renderToStaticMarkup(<CpuPage />);
}

function renderPage() {
  return render(<CpuPage />);
}

beforeEach(() => {
  store.cpu = { status: 'success', data: CPU };
  store.memory = { status: 'success', data: MEMORY };
  store.page = { status: 'success', data: [] };
  store.scripts = [];
  store.vendor = 'amd';
  store.isManual = false;
  store.handleApply.mockClear();
});

describe('CpuPage — estados', () => {
  it('mostra o esqueleto enquanto a CPU ou os scripts carregam', () => {
    store.cpu = { status: 'loading' };

    const html = renderStatic();

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Otimização do Sistema');
  });

  it('mostra o erro quando o catálogo falha', () => {
    store.page = { status: 'error', error: 'falha ao ler scripts.json' };

    const html = text(renderStatic());

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

    const html = text(renderStatic());

    expect(html).toContain('O BIOS informou apenas o identificador genérico.');
    expect(html).toContain('AMD (Família 25 · Modelo 80)');
  });

  it('não avisa quando o nome comercial foi resolvido', () => {
    expect(text(renderStatic())).not.toContain('identificador genérico');
  });
});

describe('CpuPage — núcleos estimados', () => {
  it('mostra a contagem quando o WMI informou os núcleos físicos', () => {
    expect(cell(renderStatic(), 'Núcleos')).toBe('6');
  });

  it('mostra "—" em vez de um número inventado', () => {
    store.cpu = { status: 'success', data: { ...CPU, coresEstimated: true } };

    expect(cell(renderStatic(), 'Núcleos')).toBe('—');
  });

  it('mostra "—" para todos os campos quando a leitura da CPU falha', () => {
    store.cpu = { status: 'error', error: 'WMI indisponível' };

    const html = renderStatic();

    expect(cell(html, 'Processador')).toBe('—');
    expect(cell(html, 'Núcleos')).toBe('—');
    expect(cell(html, 'Threads')).toBe('—');
    // A RAM não depende da CPU: continua sendo exibida.
    expect(cell(html, 'RAM')).toBe('16');
  });
});

describe('CpuPage — fabricante', () => {
  it('não mostra o aviso quando o fabricante foi detectado', () => {
    const html = text(renderStatic());

    expect(html).toContain('Otimização do Sistema');
    expect(html).not.toContain('Processador não identificado');
  });

  it('oferece a seleção manual quando o fabricante é desconhecido', () => {
    store.vendor = 'unknown';

    const html = text(renderStatic());

    expect(html).toContain('Processador não identificado');
    expect(html).toContain('Nenhum fabricante Intel ou AMD reconhecido em "AMD Ryzen 5 5500".');
  });

  it('mostra a faixa de seleção manual quando há override', () => {
    store.vendor = 'amd';
    store.isManual = true;

    const html = text(renderStatic());

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
  const common = script('cpu-16', 'Ajuste comum de CPU');

  it('lista apenas o degrau que cobre a RAM instalada', () => {
    store.scripts = [ram4, ram16, ram32, common];

    const html = text(renderStatic());

    expect(html).toContain('Limite do svchost (16 GB)');
    expect(html).toContain('Ajuste comum de CPU');
    expect(html).not.toContain('Limite do svchost (4 GB)');
    expect(html).not.toContain('Limite do svchost (32 GB)');
  });

  it('esconde todos os degraus enquanto a RAM é desconhecida', () => {
    store.memory = { status: 'loading' };
    store.scripts = [ram4, ram16, ram32, common];

    const html = text(renderStatic());

    expect(html).not.toContain('Limite do svchost');
    expect(html).toContain('Ajuste comum de CPU');
  });
});

describe('CpuPage — hero banner', () => {
  it('segue o padrão dos demais heroes: selo de categoria, título e descrição', () => {
    const hero = text(renderStatic()).split('Processador')[0];

    expect(hero).toContain('Desempenho');
    expect(hero).toContain('Otimização do Sistema');
    expect(hero).toContain(
      'Ajustes de hardware e do Windows para extrair mais desempenho e estabilidade do seu PC.'
    );
  });

  it.each(['amd', 'intel', 'unknown'] as const)(
    'não exibe fabricante nem modelo no hero, com %s',
    (vendor) => {
      store.vendor = vendor;

      const html = renderStatic();
      const hero = text(html).split('Processador')[0];

      expect(hero).toContain('Otimização do Sistema');
      expect(hero).not.toMatch(/AMD|Intel/);
      expect(hero).not.toContain('Ryzen');
      expect(text(html)).toContain('AMD Ryzen 5 5500');
    }
  );

  it.each(['amd', 'intel', 'unknown'] as const)(
    'usa o mesmo gradiente padrão das demais páginas com o fabricante %s',
    (vendor) => {
      store.vendor = vendor;

      const shell = heroShell(renderStatic());

      expect(shell).toContain('border-primary/20');
      expect(shell).toContain('from-primary/10');
      expect(shell).toContain('via-primary/5');
      expect(shell).not.toContain('from-destructive/10');
      expect(shell).not.toContain('from-info/10');
      expect(shell).not.toContain('from-warning/10');
    }
  );

  it('não exibe a contagem total de tweaks no hero', () => {
    store.scripts = [script('cpu-16', 'Ajuste comum de CPU')];

    const hero = text(renderStatic()).split('Processador')[0];

    expect(hero).not.toMatch(/\d+\s+tweaks/);
  });

  it.each(['amd', 'intel', 'unknown'] as const)(
    'usa a cor do tema no ícone do hero com o fabricante %s',
    (vendor) => {
      store.vendor = vendor;

      const iconClass = heroIconClass(renderStatic());

      expect(iconClass).toContain('text-primary');
      expect(iconClass).not.toContain('text-destructive');
      expect(iconClass).not.toContain('text-info');
      expect(iconClass).not.toContain('text-warning');
    }
  );
});

describe('CpuPage — seções por categoria', () => {
  it('mostra em cada seção apenas os scripts da categoria correspondente', () => {
    store.scripts = [
      script('cpu-16', 'Ajuste de processador', '', 'CPU'),
      script('builtin-4', 'Ajuste de GPU AMD', '', 'GPU'),
      script('builtin-50', 'Ajuste de Windows e energia', '', 'Windows'),
    ];

    const html = renderStatic();
    const processador = sectionText(html, PROCESSADOR, GPU_AMD);
    const gpu = sectionText(html, GPU_AMD, WINDOWS);
    const windows = sectionText(html, WINDOWS);

    expect(processador).toContain('Ajuste de processador');
    expect(processador).not.toContain('Ajuste de GPU AMD');
    expect(processador).not.toContain('Ajuste de Windows e energia');

    expect(gpu).toContain('Ajuste de GPU AMD');
    expect(gpu).not.toContain('Ajuste de processador');
    expect(gpu).not.toContain('Ajuste de Windows e energia');

    expect(windows).toContain('Ajuste de Windows e energia');
    expect(windows).not.toContain('Ajuste de processador');
    expect(windows).not.toContain('Ajuste de GPU AMD');
  });

  it('não mostra os scripts de pacote amplo tweaks-3 e tweaks-4 como cards', () => {
    store.scripts = [
      script('tweaks-3', 'Otimizar Hardware', '', 'Windows'),
      script('tweaks-4', 'Modo Gamer', '', 'Windows'),
      script('cpu-16', 'Ajuste comum de CPU'),
    ];

    const html = text(renderStatic());

    expect(html).not.toContain('Otimizar Hardware');
    expect(html).not.toContain('Modo Gamer');
    expect(html).toContain('Ajuste comum de CPU');
  });
});

describe('CpuPage — seleção múltipla', () => {
  it('aplica apenas o tweak marcado ao clicar em Aplicar selecionados', () => {
    const visivel = script('cpu-16', 'Ajuste comum de CPU');
    store.scripts = [visivel];

    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ajuste comum de CPU' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));

    expect(store.handleApply).toHaveBeenCalledTimes(1);
    expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['cpu-16']);
  });
});
