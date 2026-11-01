import type { AppSection } from './app-sections';

/**
 * Cards da pagina Privacidade. Cobre exatamente os scripts de
 * `category: "Segurança"` do catalogo — o teste em script-pages.test.ts garante
 * que nenhum script fica sem card e nenhum id sobra.
 */
export const PRIVACY_SECTIONS: AppSection[] = [
  {
    id: 'privacy',
    name: 'Privacidade',
    description:
      'Desative a telemetria e a coleta de dados do Windows e bloqueie a instalacao forcada de apps sugeridos.',
    icon: 'shield',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    scriptIds: ['apps-1', 'apps-2'],
  },
];
