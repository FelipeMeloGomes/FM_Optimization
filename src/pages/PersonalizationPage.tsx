import { Palette } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedPersonalization } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { PERSONALIZATION_SECTIONS } from '../lib/personalization-sections';

/** Config do hero fora do componente: mantém a prop estável e o memo eficaz. */
const HERO = {
  icon: Palette,
  badge: 'Personalização',
  title: 'Aparência e mods de apps',
  description:
    'Ajuste a barra de tarefas, o menu de contexto e os efeitos visuais, ou aplique mods no Discord e no Spotify. Os mods de apps incluem a opção de reverter.',
  visual: <AnimatedPersonalization />,
};

/** Ordem visual das antigas seções, preservada na lista única. */
const bySections = (scripts: ScriptEntry[]) =>
  scriptsInSectionOrder(PERSONALIZATION_SECTIONS, scripts);

export default function PersonalizationPage() {
  return (
    <TweaksPage
      category="Personalização"
      hero={HERO}
      skeletonCount={PERSONALIZATION_SECTIONS.length}
      transform={bySections}
    />
  );
}
