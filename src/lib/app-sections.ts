export type SectionIconName = 'shield' | 'trash' | 'discord' | 'music' | 'package';

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
 * Cards da pagina Aplicativos. Junto com DEBLOAT_SECTIONS, cobre exatamente os
 * scripts de `category: "Apps"` do catalogo — o teste em app-sections.test.ts
 * garante que nenhum script fica sem card e nenhum id sobra.
 */
export const APPS_SECTIONS: AppSection[] = [
  {
    id: 'privacy',
    name: 'Privacidade',
    description: 'Maximize sua privacidade desativando telemetria e coleta de dados do Windows.',
    icon: 'shield',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    scriptIds: ['apps-1'],
  },
  {
    id: 'security',
    name: 'Segurança',
    description: 'Configurações de segurança do Windows para proteger seu sistema.',
    icon: 'shield',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    scriptIds: ['apps-2'],
  },
];

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
];

export const ALL_APP_SECTIONS: AppSection[] = [...APPS_SECTIONS, ...DEBLOAT_SECTIONS];

/** Ids que moram na pagina Debloat. Usado pelo roteamento da busca (Ctrl+K). */
export const DEBLOAT_SCRIPT_IDS = new Set(DEBLOAT_SECTIONS.flatMap((section) => section.scriptIds));
