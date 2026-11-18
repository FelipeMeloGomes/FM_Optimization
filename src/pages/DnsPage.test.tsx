// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DNS_PROVIDERS } from '../lib/dns-providers';

/**
 * Regressão da página DNS: o conteúdo que saiu da página Rede continua
 * acessível em /dns — cabeçalho, provedores ordenados, benchmark, aplicar o
 * mais rápido e o selo de DNS ativo. `useDnsContext` é mockado na fronteira.
 */

vi.mock('../contexts/DnsContext', () => ({
  useDnsContext: () => store.dns,
  DnsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DnsPage from './DnsPage';

const store = vi.hoisted(() => ({
  dns: {
    networkInfo: null as {
      interfaceIndex: number;
      interfaceName: string;
      currentDns: string[];
    } | null,
    benchmarks: new Map<string, { address: string; latencyMs: number | null }>(),
    benchmarkStatus: 'idle' as 'idle' | 'loading' | 'done',
    benchmarkProgress: { current: 0, total: 0 },
    applyStatus: 'idle' as 'idle' | 'loading' | 'error' | 'elevating',
    applyError: null as string | null,
    activeDnsIps: [] as string[],
    runBenchmark: vi.fn(),
    applyDns: vi.fn(async () => {}),
  },
}));

function dns(overrides: Partial<typeof store.dns> = {}) {
  store.dns = {
    networkInfo: { interfaceIndex: 12, interfaceName: 'Ethernet', currentDns: ['1.1.1.1'] },
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

function renderPage() {
  return render(<DnsPage />);
}

beforeEach(() => dns());
afterEach(() => vi.restoreAllMocks());

describe('DnsPage', () => {
  it('renderiza o cabeçalho e todos os provedores', () => {
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

  it('aplica o DNS mais rápido chamando applyDns com o provedor correto', () => {
    dns({
      benchmarks: new Map([
        ['1.1.1.1', { address: '1.1.1.1', latencyMs: 10 }],
        ['8.8.8.8', { address: '8.8.8.8', latencyMs: 30 }],
      ]),
      benchmarkStatus: 'done',
      activeDnsIps: [],
    });
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
});
