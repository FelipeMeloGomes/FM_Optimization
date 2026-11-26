import type { AppSection } from './app-sections';

/** Cards da página Reparo do Sistema: exatamente a categoria do catálogo. */
export const REPAIR_SECTIONS: AppSection[] = [
  {
    id: 'repair',
    name: 'Integridade do sistema',
    description: 'Verifique e repare arquivos corrompidos do Windows e erros no disco.',
    icon: 'shield',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
    scriptIds: ['builtin-87', 'builtin-40', 'builtin-64'],
  },
];
