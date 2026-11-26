import type { AppSection } from './app-sections';

/** Cards da página Armazenamento: exatamente a categoria do catálogo. */
export const STORAGE_SECTIONS: AppSection[] = [
  {
    id: 'storage',
    name: 'Otimização de armazenamento',
    description: 'Libere espaço em disco, otimize o SSD e compacte os arquivos do sistema.',
    icon: 'sliders',
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
    scriptIds: ['util-2', 'util-4', 'util-5', 'builtin-88', 'util-6'],
  },
];
