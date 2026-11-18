import type { AppSection } from './app-sections';

/**
 * Cards da pagina Personalizacao. Cobre exatamente os scripts de
 * `category: "Personalização"` do catalogo — o teste em script-pages.test.ts
 * garante que nenhum script fica sem card e nenhum id sobra.
 *
 * Os ajustes mudam a aparencia do Windows (barra de tarefas, menu, efeitos) ou
 * aplicam mods em apps instalados (Equicord no Discord, Spicetify no Spotify).
 * Os mods vieram da pagina Debloat e mantem o reverter ao lado do aplicar.
 */
export const PERSONALIZATION_SECTIONS: AppSection[] = [
  {
    id: 'shell',
    name: 'Barra de tarefas e menus',
    description:
      'Deixe a barra de tarefas e o menu Iniciar mais limpos e recupere o menu de contexto clássico do Windows 10.',
    icon: 'palette',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    scriptIds: ['tweaks-1', 'builtin-86'],
  },
  {
    id: 'effects',
    name: 'Efeitos visuais',
    description:
      'Desligue animações, transparência e outros efeitos para deixar a interface mais leve. Reduz o uso de CPU e GPU na área de trabalho.',
    icon: 'monitor',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    scriptIds: ['tweaks-2', 'builtin-32'],
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
