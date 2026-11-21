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
  const byId = new Map(scripts.map((script) => [script.id, script]));
  const seen = new Set<string>();
  const out: ScriptEntry[] = [];
  for (const section of sections) {
    for (const id of section.scriptIds) {
      if (seen.has(id)) continue;
      const script = byId.get(id);
      if (!script) continue;
      seen.add(id);
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
