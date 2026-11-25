import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { TweaksPage } from '../components/TweaksPage';
import { countSectionScripts, scriptsInSectionOrder } from '../lib/app-sections';
import { HERO_ART } from '../lib/hero-art';
import { UTIL_SECTIONS } from '../lib/util-sections';

const HERO = {
  path: '/utilities',
  badge: 'Utilitários',
  title: 'Ferramentas de manutenção e reparo',
  description:
    'Mantenha seu sistema saudável com ferramentas de manutenção, gerenciamento de memória e otimizações gerais de desempenho.',
  ...HERO_ART['/utilities'],
};

/** Ordem dos antigos cards de Utilitários na lista única. */
const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(UTIL_SECTIONS, scripts);

export default function UtilitiesPage() {
  return (
    <TweaksPage
      category="Utilities"
      hero={HERO}
      skeletonCount={countSectionScripts(UTIL_SECTIONS)}
      transform={bySections}
    />
  );
}
