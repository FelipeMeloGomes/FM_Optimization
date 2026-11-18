import type { AppSection } from './app-sections';

/**
 * Cards da página Rede. Cobre exatamente as categorias "Internet" e
 * "DNS Manager" do catálogo — o teste em script-pages.test.ts garante que
 * nenhum script fica sem card e nenhum id sobra.
 *
 * A configuração visual de DNS saiu daqui para a página /dns; aqui ficam os
 * scripts, incluindo os que antes eram ocultados por `DNS_SCRIPT_IDS`.
 */
export const NETWORK_SECTIONS: AppSection[] = [
  {
    id: 'tcp-ip',
    name: 'TCP/IP e MTU',
    description:
      'Ajustes de TCP/IP, MTU, fila QoS, driver AFD e auto-tuning para reduzir latência e melhorar vazão.',
    icon: 'sliders',
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
    scriptIds: ['builtin-18', 'internet-1', 'internet-2', 'internet-3', 'internet-4', 'internet-5'],
  },
  {
    id: 'bandwidth',
    name: 'Banda e Firewall',
    description: 'Libera a banda reservada pelo Windows e ajusta as regras do firewall.',
    icon: 'shield',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
    scriptIds: ['internet-7', 'internet-10'],
  },
  {
    id: 'dns-scripts',
    name: 'DNS e resolução',
    description:
      'Scripts para trocar provedores DNS, ajustar cache e prioridade e limpar o cache do resolutor.',
    icon: 'monitor',
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
    scriptIds: ['internet-6', 'internet-8', 'dns-1', 'dns-4', 'builtin-71'],
  },
  {
    id: 'repair',
    name: 'Reparo e diagnóstico',
    description: 'Restaura a pilha de rede e diagnostica conexão e resolução de nomes.',
    icon: 'sliders',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
    scriptIds: ['internet-9', 'dns-2', 'dns-3'],
    warning:
      'O reset completo da rede reinicia o computador. Salve seu trabalho antes de executar.',
  },
  {
    id: 'restore',
    name: 'Restauração',
    description: 'Reverte todas as otimizações de Internet para os padrões do Windows.',
    icon: 'sliders',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
    scriptIds: ['internet-11'],
    warning:
      'Use apenas se tiver problemas após aplicar outros tweaks. Remove alterações de TCP/IP, MTU, DNS, AFD e firewall.',
  },
];
