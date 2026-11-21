import { HardDrive } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedStorage } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { STORAGE_SECTIONS } from '../lib/storage-sections';

/** Tweaks que só fazem sentido em máquinas com SSD. */
const SSD_ONLY_IDS = ['util-4', 'builtin-88'];

const HERO = {
  icon: HardDrive,
  badge: 'Ferramentas',
  title: 'Armazenamento',
  description: 'Libere espaço em disco, otimize o SSD e compacte os arquivos do sistema.',
  visual: <AnimatedStorage />,
};

export default function StoragePage() {
  const [hasSSD, setHasSSD] = useState<boolean | null>(null);

  useEffect(() => {
    window.electronAPI
      .hasSSD()
      .then(setHasSSD)
      .catch(() => setHasSSD(false));
  }, []);

  // Ids exclusivos de SSD somem quando a máquina não tem SSD; o restante entra
  // na lista na ordem da antiga seção, sem agrupá-la em cards.
  const transform = useCallback(
    (scripts: ScriptEntry[]) => {
      const elegiveis =
        hasSSD === true ? scripts : scripts.filter((script) => !SSD_ONLY_IDS.includes(script.id));
      return scriptsInSectionOrder(STORAGE_SECTIONS, elegiveis);
    },
    [hasSSD]
  );

  return (
    <TweaksPage
      category="Armazenamento"
      hero={HERO}
      skeletonCount={STORAGE_SECTIONS.length}
      transform={transform}
    />
  );
}
