import { Gauge, HardDrive, Rocket, Shield, Wrench, Zap } from 'lucide-react';
import type { ElementType } from 'react';

export interface UtilSection {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  scriptIds: string[];
}

/**
 * Cards da pagina Utilitarios. Cobre exatamente os scripts de
 * `category: "Utilities"` do catalogo — o teste em script-pages.test.ts garante
 * que nenhum script fica sem card e nenhum id sobra.
 */
export const UTIL_SECTIONS: UtilSection[] = [
  {
    id: 'maintenance',
    name: 'Manutenção do Sistema',
    description: 'Pacotes de manutenção e relatórios para manter o sistema saudável.',
    icon: Wrench,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    scriptIds: ['util-1', 'util-3'],
  },
  {
    id: 'storage',
    name: 'Armazenamento',
    description: 'Otimização de SSD, compactação de sistema e limpeza de componentes.',
    icon: HardDrive,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    scriptIds: ['util-2', 'util-4', 'util-5', 'builtin-88', 'util-6'],
  },
  {
    id: 'repair',
    name: 'Reparo do Sistema',
    description: 'Verificação e reparo de integridade do sistema de arquivos e componentes.',
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    scriptIds: ['builtin-87', 'builtin-40', 'builtin-64'],
  },
  {
    id: 'memory',
    name: 'Memória e Processos',
    description: 'Libere RAM e encerre processos desnecessários para melhor performance.',
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    scriptIds: ['builtin-22', 'builtin-27'],
  },
  {
    id: 'performance',
    name: 'Performance',
    description:
      'Prioridade de CPU e GPU, escalonamento e responsividade para melhor desempenho em jogos.',
    icon: Gauge,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    scriptIds: ['builtin-15'],
  },
  {
    id: 'complete',
    name: 'Otimização Completa',
    description:
      'Pacote completo que aplica todas as otimizações de uma vez. Para quem quer resultado rápido.',
    icon: Rocket,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    scriptIds: ['builtin-13'],
  },
];
