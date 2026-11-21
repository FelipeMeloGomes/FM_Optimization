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

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole('heading', { level: 3, name }).closest('.rounded-lg');
  if (!card) throw new Error(`card do provedor ${name} não encontrado`);
  return card as HTMLElement;
}

function resultado(address: string, latencyMs: number | null) {
  return [address, { address, latencyMs }] as const;
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

  it('exibe os provedores adicionais na página', () => {
    renderPage();

    for (const name of [
      'Cloudflare Security',
      'Cloudflare Family',
      'DNS4EU Protective',
      'DNS.WATCH',
      'SafeDNS',
    ]) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it('usa o hero banner padrão, com o benchmark na faixa abaixo dele', () => {
    const { container } = renderPage();
    const hero = container.querySelector('.bg-gradient-to-br');
    const button = screen.getByRole('button', { name: 'Testar Novamente' });

    expect(hero).not.toBeNull();
    expect(hero?.querySelector('h2')?.textContent).toBe('DNS');
    expect(hero?.textContent).toContain('Rede');
    expect(hero?.contains(button)).toBe(false);
    expect(screen.getByRole('group', { name: 'Atualizar dados' }).contains(button)).toBe(true);
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

  it('coloca o provedor ativo em primeiro depois do benchmark', () => {
    dns({
      benchmarks: new Map([
        resultado('1.1.1.1', 8),
        resultado('1.0.0.1', 8),
        resultado('8.8.8.8', 40),
        resultado('8.8.4.4', 40),
      ]),
      benchmarkStatus: 'done',
      activeDnsIps: ['8.8.8.8', '8.8.4.4'],
    });

    renderPage();

    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes[0]).toBe('Google');
  });

  it('coloca o provedor ativo em primeiro durante a varredura', () => {
    dns({
      benchmarkStatus: 'loading',
      benchmarks: new Map([resultado('1.1.1.1', 8), resultado('1.0.0.1', 8)]),
      activeDnsIps: ['8.8.8.8', '8.8.4.4'],
    });

    renderPage();

    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes[0]).toBe('Google');
  });

  it('coloca o DHCP em primeiro quando é o DNS ativo', () => {
    dns({ activeDnsIps: [], benchmarkStatus: 'done' });

    renderPage();

    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes[0]).toBe('DHCP (Padrão)');
  });

  it('mantém o provedor mais rápido correto quando o ativo não é o mais rápido', () => {
    dns({
      benchmarks: new Map([
        resultado('1.1.1.1', 8),
        resultado('1.0.0.1', 8),
        resultado('8.8.8.8', 40),
        resultado('8.8.4.4', 40),
      ]),
      benchmarkStatus: 'done',
      activeDnsIps: ['8.8.8.8', '8.8.4.4'],
    });

    renderPage();

    expect(screen.getByRole('heading', { level: 2, name: 'Cloudflare' })).toBeDefined();
  });

  it('não reordena os demais provedores enquanto a varredura está em andamento', () => {
    dns({
      benchmarkStatus: 'loading',
      activeDnsIps: ['195.46.39.39', '195.46.39.40'],
      benchmarks: new Map([
        resultado('1.1.1.1', 200),
        resultado('1.0.0.1', 200),
        resultado('8.8.8.8', 8),
        resultado('8.8.4.4', 8),
      ]),
    });

    renderPage();

    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes[0]).toBe('SafeDNS');
    expect(nomes[1]).toBe('Cloudflare');
    expect(nomes[2]).toBe('Google');
  });

  it('marca somente o próximo provedor como em teste, com a varredura no próprio card', () => {
    dns({
      benchmarkStatus: 'loading',
      benchmarks: new Map([resultado('1.1.1.1', 8), resultado('1.0.0.1', 8)]),
    });

    renderPage();

    expect(screen.getAllByText('Testando', { exact: true })).toHaveLength(1);
    const card = cardFor('Google');
    expect(card.textContent).toContain('Testando');
    expect(card.className).toContain('dns-scan-card');
    expect(card.querySelector('.dns-scan-line')).not.toBeNull();
  });

  it('mostra o resultado no próprio card assim que o provedor é medido', () => {
    dns({
      benchmarkStatus: 'loading',
      benchmarks: new Map([resultado('1.1.1.1', 8), resultado('1.0.0.1', 8)]),
    });

    renderPage();

    const card = cardFor('Cloudflare');
    expect(card.textContent).toContain('8');
    expect(card.textContent).not.toContain('Testando');
    expect(card.className).toContain('dns-result-in');
  });

  it('considera medido um DNS cuja latência falhou e segue para o próximo', () => {
    dns({
      benchmarkStatus: 'loading',
      benchmarks: new Map([resultado('1.1.1.1', null), resultado('1.0.0.1', null)]),
    });

    renderPage();

    expect(
      screen.getByText('Testando', { exact: true }).closest('.rounded-lg')?.textContent
    ).toContain('Google');
  });

  it('substitui o painel genérico por uma trilha com um segmento por DNS', () => {
    dns({ benchmarkStatus: 'loading' });

    renderPage();

    expect(screen.queryByText('Testando velocidade dos DNSs…')).toBeNull();
    const rail = screen.getByRole('progressbar', { name: 'Varredura de DNS' });
    expect(rail.getAttribute('aria-valuemin')).toBe('0');
    expect(rail.getAttribute('aria-valuemax')).toBe('19');
    expect(rail.getAttribute('aria-valuenow')).toBe('0');
    expect(rail.querySelectorAll('span')).toHaveLength(19);
    expect(screen.getByText('Varredura em andamento')).toBeDefined();
  });

  it('preenche a trilha conforme os resultados chegam e a remove ao terminar', () => {
    dns({
      benchmarkStatus: 'loading',
      benchmarks: new Map([resultado('1.1.1.1', 8), resultado('1.0.0.1', 8)]),
    });
    const { rerender } = renderPage();

    const rail = screen.getByRole('progressbar', { name: 'Varredura de DNS' });
    expect(rail.getAttribute('aria-valuenow')).toBe('1');
    expect(rail.querySelectorAll('.bg-primary')).toHaveLength(1);

    dns({
      benchmarkStatus: 'done',
      benchmarks: new Map([resultado('1.1.1.1', 8), resultado('1.0.0.1', 8)]),
    });
    rerender(<DnsPage />);

    expect(screen.queryByRole('progressbar', { name: 'Varredura de DNS' })).toBeNull();
  });
});
