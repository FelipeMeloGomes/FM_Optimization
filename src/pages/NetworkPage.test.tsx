// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncState, ScriptEntry } from '../../electron/shared/ipc-types';
import { DNS_PROVIDERS } from '../lib/dns-providers';

/**
 * Regressão da página Rede: cabeçalho DNS, provedores ordenados por latência,
 * aplicar DNS mais rápido (chama `applyDns`), executar benchmark
 * (`runBenchmark`) e scripts de Internet (chama `execute`). `useDnsContext`,
 * `useScriptContext`, `useScriptExecutionContext` e `useSettingsContext` são
 * mockados na fronteira.
 */

vi.mock('../contexts/DnsContext', () => ({
  useDnsContext: () => store.dns,
  DnsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => store.script,
}));

vi.mock('../contexts/ScriptExecutionContext', () => ({
  useScriptExecutionContext: () => store.exec,
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { confirmOnExecute: false } }),
}));

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: { status: 'success', data: [] } }),
}));

vi.mock('../components/BatmanBackground', () => ({ BatmanBackground: () => null }));

import NetworkPage from './NetworkPage';

const store: {
  dns: {
    networkInfo: { interfaceIndex: number; interfaceName: string; currentDns: string[] };
    benchmarks: Map<string, { address: string; latencyMs: number | null }>;
    benchmarkStatus: 'idle' | 'loading' | 'done';
    benchmarkProgress: { current: number; total: number };
    applyStatus: 'idle' | 'loading' | 'error' | 'elevating';
    applyError: string | null;
    activeDnsIps: string[];
    runBenchmark: ReturnType<typeof vi.fn>;
    applyDns: ReturnType<typeof vi.fn>;
  };
  script: {
    state: AsyncState<ScriptEntry[]>;
    filteredScripts: ScriptEntry[];
    setCategoryFilter: ReturnType<typeof vi.fn>;
    setSubcategoryFilter: ReturnType<typeof vi.fn>;
    categoryFilter: string;
    subcategoryFilter: string;
    subcategories: string[];
  };
  exec: {
    activeExecution: string | null;
    execute: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
} = {
  dns: {
    networkInfo: { interfaceIndex: 12, interfaceName: 'Ethernet', currentDns: ['1.1.1.1'] },
    benchmarks: new Map(),
    benchmarkStatus: 'idle',
    benchmarkProgress: { current: 0, total: 0 },
    applyStatus: 'idle',
    applyError: null,
    activeDnsIps: [],
    runBenchmark: vi.fn(),
    applyDns: vi.fn(async () => {}),
  },
  script: {
    state: { status: 'success', data: [] },
    filteredScripts: [],
    setCategoryFilter: vi.fn(),
    setSubcategoryFilter: vi.fn(),
    categoryFilter: '',
    subcategoryFilter: '',
    subcategories: [],
  },
  exec: {
    activeExecution: null,
    execute: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
  },
};

beforeEach(() => {
  dns();
  script();
  exec();
});

function dns(overrides: Partial<typeof store.dns> = {}) {
  store.dns = {
    networkInfo: { interfaceIndex: 12, interfaceName: 'Ethernet', currentDns: ['1.1.1.1'] } as any,
    benchmarks: new Map(),
    benchmarkStatus: 'idle',
    benchmarkProgress: { current: 0, total: 0 },
    applyStatus: 'idle',
    applyError: null,
    activeDnsIps: [],
    runBenchmark: vi.fn(),
    applyDns: vi.fn(async () => {}),
    ...overrides,
  };
}

function script(overrides: Partial<typeof store.script> = {}) {
  store.script = {
    state: { status: 'success', data: [] },
    filteredScripts: [],
    setCategoryFilter: vi.fn(),
    setSubcategoryFilter: vi.fn(),
    categoryFilter: '',
    subcategoryFilter: '',
    subcategories: [],
    ...overrides,
  };
}

function exec(overrides: Partial<typeof store.exec> = {}) {
  store.exec = {
    activeExecution: null,
    execute: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderPage() {
  return render(<NetworkPage />);
}

beforeEach(() => {
  dns();
  script();
  exec();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkPage', () => {
  it('renderiza o cabeçalho DNS e os provedores', () => {
    renderPage();

    expect(screen.getByText('DNS')).toBeDefined();
    expect(
      screen.getByText('Configure seu DNS para melhor velocidade e privacidade')
    ).toBeDefined();
    expect(screen.getByText('Cloudflare')).toBeDefined();
    expect(screen.getByText('Google')).toBeDefined();
    expect(screen.getByText('Quad9')).toBeDefined();
    expect(screen.getByText('OpenDNS')).toBeDefined();
    expect(screen.getByText('AdGuard')).toBeDefined();
    expect(screen.getByText('CleanBrowsing')).toBeDefined();
    expect(screen.getByText('DHCP (Padrão)')).toBeDefined();
  });

  it('executa o benchmark chamando runBenchmark', () => {
    const { runBenchmark } = store.dns;

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Testar Novamente' }));

    expect(runBenchmark).toHaveBeenCalled();
  });

  it('aplica o DNS mais rápido chamando applyDns com o provedor correto', async () => {
    dns({
      benchmarks: new Map([
        ['1.1.1.1', { address: '1.1.1.1', latencyMs: 10 }],
        ['8.8.8.8', { address: '8.8.8.8', latencyMs: 30 }],
      ]),
      benchmarkStatus: 'done',
      activeDnsIps: [],
    });
    script();
    exec();

    const { applyDns } = store.dns;
    const cloudflare = DNS_PROVIDERS.find((p) => p.name === 'Cloudflare')!;

    renderPage();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Aplicar DNS Mais Rápido' })));

    expect(applyDns).toHaveBeenCalledWith(cloudflare);
  });

  it('mostra "Ativo" para o provedor já em uso', () => {
    dns({
      benchmarks: new Map([['1.1.1.1', { address: '1.1.1.1', latencyMs: 10 }]]),
      benchmarkStatus: 'done',
      activeDnsIps: ['1.1.1.1', '1.0.0.1'],
    });

    renderPage();

    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
    expect(screen.getByText('DNS Ativo')).toBeDefined();
  });

  it('renderiza a seção de scripts de Internet quando há tweaks', () => {
    script({
      filteredScripts: [
        {
          id: 'internet-1',
          name: 'DNS do Google',
          description: '',
          category: 'Internet',
          subcategory: '',
          content: '',
          extension: 'reg',
          requiresAdmin: false,
          isBuiltIn: true,
          tags: [] as string[],
        },
      ],
    });

    renderPage();

    expect(screen.getByText('DNS do Google')).toBeDefined();
    expect(screen.getByText(/1 tweak/)).toBeDefined();
  });
});
