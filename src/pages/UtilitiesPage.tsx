import { Wrench } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedUtilities } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { UTIL_SECTIONS } from '../lib/util-sections';

const HERO = {
  icon: Wrench,
  badge: 'Utilitários',
  title: 'Ferramentas de manutenção e reparo',
  description:
    'Mantenha seu sistema saudável com ferramentas de manutenção, gerenciamento de memória e otimizações gerais de desempenho.',
  visual: <AnimatedUtilities />,
};

/** Ordem dos antigos cards de Utilitários na lista única. */
const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(UTIL_SECTIONS, scripts);

export default function UtilitiesPage() {
  return (
    <TweaksPage
      category="Utilities"
      hero={HERO}
      skeletonCount={UTIL_SECTIONS.length}
      transform={bySections}
    />
  );
}
