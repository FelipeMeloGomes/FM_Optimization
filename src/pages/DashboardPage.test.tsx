import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  CpuInfo,
  DashboardData,
  ExecutionHistoryEntry,
  ScriptEntry,
} from '../../electron/shared/ipc-types';

/**
 * Regressão das regras de exibição do Dashboard.
 *
 * O componente é renderizado de verdade (SSR), com apenas os três contextos
 * mockados na fronteira. Assim os testes travam o que o JSX decide — rótulo de
 * núcleos estimados, rodapé de otimização, saúde, uptime e percentual de RAM —
 * e não uma reimplementação dessas regras no teste.
 */

const store = vi.hoisted(() => ({
  system: { status: 'loading' } as AsyncState<DashboardData>,
  scripts: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  history: { status: 'loading' } as AsyncState<ExecutionHistoryEntry[]>,
}));

vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({ state: store.system, refreshing: false, refresh: () => {} }),
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({ state: store.scripts }),
}));

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: store.history }),
}));

import DashboardPage from './DashboardPage';

const CPU: CpuInfo = {
  model: 'AMD Ryzen 7 5700X',
  rawModel: 'AMD Ryzen 7 5700X 8-Core Processor',
  manufacturer: 'AuthenticAMD',
  vendor: 'amd',
  cores: 8,
  logicalProcessors: 16,
  architecture: 'x64',
  usage: 12,
  coresEstimated: false,
};

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    cpu: CPU,
    gpu: { name: 'AMD Radeon RX 7600', vram: '8 GB', driverVersion: '32.0.1', usage: 4 },
    memory: {
      total: '32 GB',
      used: '12 GB',
      free: '20 GB',
      type: 'DDR4',
      slots: 2,
      frequency: '3200 MHz',
    },
    os: {
      name: 'Windows 11 Pro',
      version: '10.0.26100',
      build: '26100',
      edition: 'Pro',
      installDate: '2025-01-01',
    },
    drives: [
      {
        letter: 'C:',
        label: 'Sistema',
        size: '1 TB',
        free: '400 GB',
        usedPercent: 60,
        type: 'SSD',
      },
    ],
    uptime: 90061, // 1d 1h 1m
    ...overrides,
  };
}

function script(id: string, category = 'CPU'): ScriptEntry {
  return {
    id,
    name: `Script ${id}`,
    description: '',
    category,
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
  };
}

function executed(scriptId: string): ExecutionHistoryEntry {
  return {
    id: `${scriptId}_2026-01-01T00:00:00.000Z`,
    scriptId,
    scriptName: scriptId,
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    exitCode: 0,
    wasCancelled: false,
  };
}

/** Texto visível, sem tags e sem os comentários que o SSR insere entre nós. */
function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(): string {
  return text(renderToStaticMarkup(<DashboardPage />));
}

beforeEach(() => {
  store.system = { status: 'loading' };
  store.scripts = { status: 'loading' };
  store.history = { status: 'loading' };
});

describe('DashboardPage — estados de carregamento', () => {
  it('mostra o esqueleto enquanto o sistema carrega', () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('animate-pulse');
    expect(text(html)).not.toContain('Windows 11 Pro');
  });

  it('mostra o erro e o botão de tentar novamente', () => {
    store.system = { status: 'error', error: 'WMI indisponível' };

    const html = render();

    expect(html).toContain('Erro ao carregar informações do sistema');
    expect(html).toContain('WMI indisponível');
    expect(html).toContain('Tentar novamente');
  });
});

describe('DashboardPage — dados do sistema', () => {
  it('mostra SO, build, componentes e discos', () => {
    store.system = { status: 'success', data: dashboard() };

    const html = render();

    expect(html).toContain('Windows 11 Pro');
    expect(html).toContain('Build 26100 · Pro');
    expect(html).toContain('AMD Ryzen 7 5700X');
    expect(html).toContain('AMD Radeon RX 7600');
    expect(html).toContain('32 GB');
    expect(html).toContain('Disco C:');
    expect(html).toContain('1 TB');
  });

  it('lista os núcleos físicos quando a contagem foi lida', () => {
    store.system = { status: 'success', data: dashboard() };

    expect(render()).toContain('8 núcleos · 16 threads · 12% uso');
  });

  it('troca os núcleos pelo aviso quando a contagem é estimada', () => {
    store.system = {
      status: 'success',
      data: dashboard({ cpu: { ...CPU, coresEstimated: true } }),
    };

    const html = render();

    expect(html).toContain('núcleos não detectados · 16 threads · 12% uso');
    expect(html).not.toContain('8 núcleos');
  });

  it('calcula o percentual de RAM usado a partir dos tamanhos formatados', () => {
    store.system = { status: 'success', data: dashboard() };

    // 12 de 32 GB = 37,5% → 38%.
    expect(render()).toContain('38%');
  });

  it('mostra a saúde do sistema e o rótulo correspondente', () => {
    store.system = { status: 'success', data: dashboard() };

    const html = render();

    expect(html).toContain('100%');
    expect(html).toContain('Saúde: Saudável');
  });

  it('cai para Atenção quando CPU, RAM e disco estão todos no limite', () => {
    store.system = {
      status: 'success',
      data: dashboard({
        cpu: { ...CPU, usage: 90 },
        memory: {
          total: '32 GB',
          used: '30 GB',
          free: '2 GB',
          type: 'DDR4',
          slots: 2,
          frequency: '3200 MHz',
        },
        drives: [
          {
            letter: 'C:',
            label: 'Sistema',
            size: '1 TB',
            free: '50 GB',
            usedPercent: 95,
            type: 'SSD',
          },
        ],
      }),
    };

    const html = render();

    expect(html).toContain('50%');
    expect(html).toContain('Saúde: Atenção');
  });

  it('formata o uptime em dias, horas e minutos', () => {
    store.system = { status: 'success', data: dashboard({ uptime: 90061 }) };
    expect(render()).toContain('1d 1h 1m');

    store.system = { status: 'success', data: dashboard({ uptime: 3661 }) };
    expect(render()).toContain('1h 1m');

    store.system = { status: 'success', data: dashboard({ uptime: 90 }) };
    expect(render()).toContain('Atividade: 1m');
  });
});

describe('DashboardPage — rodapé de ajustes aplicados', () => {
  function withTweaks(scripts: ScriptEntry[], history: ExecutionHistoryEntry[]): void {
    store.system = { status: 'success', data: dashboard() };
    store.scripts = { status: 'success', data: scripts };
    store.history = { status: 'success', data: history };
  }

  it('mostra "Verificando ajustes…" enquanto o histórico não chega', () => {
    store.system = { status: 'success', data: dashboard() };
    store.scripts = { status: 'success', data: [script('a')] };
    store.history = { status: 'loading' };

    const html = render();

    expect(html).toContain('Verificando ajustes…');
    expect(html).not.toContain('ajustes aplicados');
  });

  it('marca Parcialmente Otimizado abaixo da metade', () => {
    withTweaks([script('a'), script('b'), script('c')], [executed('a')]);

    const html = render();

    expect(html).toContain('1 de 3 ajustes aplicados');
    expect(html).toContain('Parcialmente Otimizado');
  });

  it('marca Sistema Otimizado a partir da metade', () => {
    // O limiar é `< 0.5`: exatamente 50% já conta como otimizado.
    withTweaks([script('a'), script('b')], [executed('a')]);

    const html = render();

    expect(html).toContain('1 de 2 ajustes aplicados');
    expect(html).toContain('Sistema Otimizado');
  });

  it('marca Nenhum ajuste aplicado quando o histórico está vazio', () => {
    withTweaks([script('a'), script('b')], []);

    const html = render();

    expect(html).toContain('0 de 2 ajustes aplicados');
    expect(html).toContain('Nenhum ajuste aplicado');
  });

  it('não conta reverters nem no numerador nem no denominador', () => {
    // cpu-37 é reverter e fica fora do selo/contador; se ele entrasse, o
    // rodapé diria "1 de 2".
    withTweaks([script('a'), script('cpu-37')], [executed('cpu-37')]);

    const html = render();

    expect(html).toContain('0 de 1 ajustes aplicados');
    expect(html).not.toContain('1 de 2');
  });
});
