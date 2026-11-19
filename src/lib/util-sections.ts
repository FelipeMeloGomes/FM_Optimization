import { Wrench, Zap } from 'lucide-react';
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
 * que nenhum script fica sem card e nenhum id sobra. O relatorio de sistema
 * (`util-3`) mora na pagina Meu PC e nao aparece aqui.
 */
export const UTIL_SECTIONS: UtilSection[] = [
  {
    id: 'maintenance',
    name: 'Manutenção do Sistema',
    description: 'Pacotes de manutenção para manter o sistema saudável.',
    icon: Wrench,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    scriptIds: ['util-1'],
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
];
