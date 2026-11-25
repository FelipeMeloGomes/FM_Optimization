import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { TweaksPage } from '../components/TweaksPage';
import { countSectionScripts, scriptsInSectionOrder } from '../lib/app-sections';
import { HERO_ART } from '../lib/hero-art';
import { NETWORK_SECTIONS } from '../lib/network-sections';

/**
 * A configuração visual de DNS saiu daqui para `DnsPage` (/dns). Esta página
 * mantém só os scripts de rede, apresentados em uma lista única no padrão
 * da Limpeza, com barra de seleção e confirmação de lote.
 */
const HERO = {
  path: '/rede',
  badge: 'Rede',
  title: 'Internet',
  description:
    'Scripts para otimizar sua conexão de internet e corrigir problemas de rede. Para escolher e aplicar um provedor DNS, use a página DNS.',
  ...HERO_ART['/rede'],
};

/** Ids fora das seções não entram na lista nem na seleção. */
const bySections = (scripts: ScriptEntry[]) => scriptsInSectionOrder(NETWORK_SECTIONS, scripts);

export default function NetworkPage() {
  return (
    <TweaksPage
      category={['Internet', 'DNS Manager']}
      hero={HERO}
      skeletonCount={countSectionScripts(NETWORK_SECTIONS)}
      transform={bySections}
    />
  );
}
