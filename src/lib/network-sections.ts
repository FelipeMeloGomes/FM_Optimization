import type { AppSection } from './app-sections';

/**
 * Cards da página Internet. Cobre exatamente as categorias "Internet" e
 * "DNS Manager" do catálogo — o teste em script-pages.test.ts garante que
 * nenhum script fica sem card e nenhum id sobra.
 *
 * A configuração visual de DNS vive em /dns e os scripts de troca de
 * provedor/cache do resolutor saíram do catálogo: aqui ficam os ajustes de
 * rede e os scripts de reparo de resolução de nomes.
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
