import { ShieldCheck } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedRepair } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { REPAIR_SECTIONS } from '../lib/repair-sections';

const HERO = {
  icon: ShieldCheck,
  badge: 'Ferramentas',
  title: 'Reparo do Sistema',
  description: 'Verifique e repare arquivos corrompidos do Windows e erros no disco.',
  visual: <AnimatedRepair />,
};

const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(REPAIR_SECTIONS, scripts);

export default function SystemRepairPage() {
  return (
    <TweaksPage
      category="Reparo do Sistema"
      hero={HERO}
      skeletonCount={REPAIR_SECTIONS.length}
      transform={bySections}
    />
  );
}
