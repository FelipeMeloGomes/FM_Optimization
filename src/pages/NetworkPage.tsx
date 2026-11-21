import { Wifi } from 'lucide-react';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedNetwork } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { scriptsInSectionOrder } from '../lib/app-sections';
import { NETWORK_SECTIONS } from '../lib/network-sections';

/**
 * A configuração visual de DNS saiu daqui para `DnsPage` (/dns). Esta página
 * mantém só os scripts de rede, apresentados em uma lista única no padrão
 * da Limpeza, com barra de seleção e confirmação de lote.
 */
const HERO = {
  icon: Wifi,
  badge: 'Rede',
  title: 'Internet',
  description:
    'Scripts para otimizar sua conexão de internet e corrigir problemas de rede. Para escolher e aplicar um provedor DNS, use a página DNS.',
  visual: <AnimatedNetwork />,
};

/** Ids fora das seções não entram na lista nem na seleção. */
const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(NETWORK_SECTIONS, scripts);

export default function NetworkPage() {
  return (
    <TweaksPage
      category={['Internet', 'DNS Manager']}
      hero={HERO}
      skeletonCount={NETWORK_SECTIONS.length}
      transform={bySections}
    />
  );
}
