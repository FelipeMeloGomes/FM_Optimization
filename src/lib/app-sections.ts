import type { ScriptEntry } from '../../electron/shared/ipc-types';

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

/**
 * Quantidade de scripts visíveis nas seções. Usada pelo esqueleto para mostrar
 * o mesmo número de linhas da lista carregada, sem números digitados à mão.
 */
export function countSectionScripts(sections: ReadonlyArray<{ scriptIds: string[] }>): number {
  return sections.reduce((total, section) => total + section.scriptIds.length, 0);
}

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
 * Achata os ids das seções na ordem em que aparecem, resolvendo cada id contra
 * o catálogo da página. Ids repetidos ou ausentes são ignorados: a lista
 * resultante contém exatamente os scripts visíveis, na ordem visual original.
 *
 * Usado pelas páginas que trocaram os cards por uma lista única no padrão da
 * Limpeza, preservando a ordem em que os tweaks apareciam agrupados.
 */
export function scriptsInSectionOrder(
  sections: ReadonlyArray<{ scriptIds: string[] }>,
  scripts: ScriptEntry[]
): ScriptEntry[] {
  const seen = new Set<string>();
  const out: ScriptEntry[] = [];
  for (const section of sections) {
    const inSection = new Set(section.scriptIds);
    // Percorre o catálogo, não `scriptIds`: era assim que as seções filtravam
    // antes da lista única, e a ordem da tela também é a ordem do lote.
    for (const script of scripts) {
      if (seen.has(script.id) || !inSection.has(script.id)) continue;
      seen.add(script.id);
      out.push(script);
    }
  }
  return out;
}

/**
 * A pagina Debloat deixou de ser uma lista de cards: ela agora e o inventario
 * de apps Appx do Windows (ver `DebloatPage`), e Utilitarios trocou os cards
 * pela lista unica. Este modulo guarda so os tipos compartilhados pelos cards
 * que restaram (Personalizacao, Privacidade e Otimização do Sistema).
 */
