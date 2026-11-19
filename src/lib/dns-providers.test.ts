import { describe, expect, it } from 'vitest';
import { DNS_PROVIDERS, type DnsProvider } from './dns-providers';

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function ips(provider: DnsProvider): string {
  return `${provider.primary}|${provider.secondary}`;
}

describe('DNS_PROVIDERS', () => {
  it('oferece 20 opções, preservando os provedores já existentes', () => {
    expect(DNS_PROVIDERS).toHaveLength(20);

    for (const name of [
      'Cloudflare',
      'Google',
      'Quad9',
      'OpenDNS',
      'AdGuard',
      'CleanBrowsing',
      'DHCP (Padrão)',
    ]) {
      expect(DNS_PROVIDERS.some((provider) => provider.name === name)).toBe(true);
    }
  });

  it('substitui o Oracle Dyn, que não responde ICMP, pela SafeDNS', () => {
    const nomes = DNS_PROVIDERS.map((provider) => provider.name);

    expect(nomes).not.toContain('Oracle Dyn');
    expect(nomes).not.toContain('Control D');
    expect(nomes).toContain('SafeDNS');

    const safedns = DNS_PROVIDERS.find((provider) => provider.name === 'SafeDNS');
    expect(safedns?.primary).toBe('195.46.39.39');
    expect(safedns?.secondary).toBe('195.46.39.40');
  });

  it('não repete nomes nem pares de endereços', () => {
    const names = DNS_PROVIDERS.map((provider) => provider.name);
    const addresses = DNS_PROVIDERS.filter((provider) => !provider.isDhcp).map(ips);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('usa IPv4 válidos em primário e secundário de todos os resolvedores', () => {
    for (const provider of DNS_PROVIDERS.filter((item) => !item.isDhcp)) {
      expect(provider.primary, `${provider.name} primário`).toMatch(IPV4);
      expect(provider.secondary, `${provider.name} secundário`).toMatch(IPV4);
      expect(provider.features.length).toBeGreaterThan(0);
    }
  });

  it('mantém o DHCP como única opção sem endereço, por último', () => {
    const dhcp = DNS_PROVIDERS.filter((provider) => provider.isDhcp);

    expect(dhcp).toHaveLength(1);
    expect(DNS_PROVIDERS.at(-1)?.isDhcp).toBe(true);
    expect(dhcp[0].primary).toBe('');
    expect(dhcp[0].secondary).toBe('');
  });
});
