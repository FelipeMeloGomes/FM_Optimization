import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { TweaksPage } from '../components/TweaksPage';
import { countSectionScripts, scriptsInSectionOrder } from '../lib/app-sections';
import { HERO_ART } from '../lib/hero-art';
import { PRIVACY_SECTIONS } from '../lib/privacy-sections';

const HERO = {
  path: '/privacidade-seguranca',
  badge: 'Privacidade',
  title: 'Privacidade do Windows',
  description:
    'Desative telemetria e coleta de dados e bloqueie a instalação forçada de apps sugeridos pelo sistema. Estes ajustes não alteram o Windows Defender nem o Windows Update.',
  ...HERO_ART['/privacidade-seguranca'],
};

const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(PRIVACY_SECTIONS, scripts);

export default function PrivacySecurityPage() {
  return (
    <TweaksPage
      category="Segurança"
      hero={HERO}
      skeletonCount={countSectionScripts(PRIVACY_SECTIONS)}
      transform={bySections}
    />
  );
}
