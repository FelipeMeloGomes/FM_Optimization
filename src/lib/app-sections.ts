export type SectionIconName = 'shield' | 'trash' | 'discord' | 'music' | 'package' | 'monitor';

export interface AppSection {
  id: string;
  name: string;
  description: string;
  icon: SectionIconName;
  color: string;
  bgColor: string;
  borderColor: string;
  scriptIds: string[];
  warning?: string;
}

/**
 * Cards da pagina Debloat. Cobre exatamente os scripts de `category: "Debloat"`
 * do catalogo — o teste em script-pages.test.ts garante que nenhum script fica
 * sem card e nenhum id sobra. O card "Otimização Visual" veio da antiga pagina
 * Ajustes com os mesmos quatro scripts.
 */
export const DEBLOAT_SECTIONS: AppSection[] = [
  {
    id: 'debloat',
    name: 'Remover Bloatware',
    description: 'Remova aplicativos desnecessários pré-instalados no Windows.',
    icon: 'trash',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    scriptIds: ['apps-3', 'builtin-14'],
    warning: 'Alguns apps do sistema podem ser removidos. Use com cautela.',
  },
  {
    id: 'discord',
    name: 'Discord',
    description:
      'Instale o Equicord com o plugin FakeNitro para desbloquear emotes, stickers e uploads maiores. Inclui opção de reverter.',
    icon: 'discord',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    scriptIds: ['apps-4', 'apps-5'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description:
      'Debloat do Spotify com Spicetify: bloqueador de anúncios, Marketplace de temas e customização completa. Inclui opção de reverter.',
    icon: 'music',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    scriptIds: ['apps-6', 'apps-7'],
    warning: 'Não funciona com o Spotify da Microsoft Store. Instale a versão desktop.',
  },
  {
    id: 'visual',
    name: 'Otimização Visual',
    description:
      'Ajuste efeitos visuais do Windows para melhor desempenho sem sacrificar a estética.',
    icon: 'monitor',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    scriptIds: ['tweaks-1', 'tweaks-2', 'builtin-32', 'builtin-86'],
  },
];
