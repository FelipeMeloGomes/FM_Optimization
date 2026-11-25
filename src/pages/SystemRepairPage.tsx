import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { TweaksPage } from '../components/TweaksPage';
import { countSectionScripts, scriptsInSectionOrder } from '../lib/app-sections';
import { HERO_ART } from '../lib/hero-art';
import { REPAIR_SECTIONS } from '../lib/repair-sections';

const HERO = {
  path: '/reparo-do-sistema',
  badge: 'Ferramentas',
  title: 'Reparo do Sistema',
  description: 'Verifique e repare arquivos corrompidos do Windows e erros no disco.',
  ...HERO_ART['/reparo-do-sistema'],
};

const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(REPAIR_SECTIONS, scripts);

export default function SystemRepairPage() {
  return (
    <TweaksPage
      category="Reparo do Sistema"
      hero={HERO}
      skeletonCount={countSectionScripts(REPAIR_SECTIONS)}
      transform={bySections}
    />
  );
}
