import type { AppSection } from './app-sections';

/**
 * Cards da pagina Personalizacao. Cobre exatamente os scripts de
 * `category: "Personalização"` do catalogo — o teste em script-pages.test.ts
 * garante que nenhum script fica sem card e nenhum id sobra.
 *
 * Estes scripts mudam a aparencia do Windows (barra de tarefas, menu, efeitos)
 * e nao removem software; por isso sairam da pagina Debloat.
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
];
