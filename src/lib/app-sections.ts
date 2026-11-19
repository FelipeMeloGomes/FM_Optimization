export type SectionIconName =
  | 'shield'
  | 'trash'
  | 'discord'
  | 'music'
  | 'package'
  | 'monitor'
  | 'cpu'
  | 'sliders'
  | 'palette';

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
 * A pagina Debloat deixou de ser uma lista de cards: ela agora e o inventario
 * de apps Appx do Windows (ver `DebloatPage`). Este modulo guarda so os tipos
 * compartilhados pelos cards que restaram (Personalizacao, Privacidade,
 * Utilitarios e Otimização do Sistema).
 */
