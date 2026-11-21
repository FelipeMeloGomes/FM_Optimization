import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { AnimatedInputLag } from '../components/hero/AnimatedHero';
import { TweaksPage } from '../components/TweaksPage';
import { resolveCuratedItems } from '../lib/resolve-curated-scripts';

interface RegistryItem {
  id: string;
  name: string;
  description: string;
  scriptId: string;
}

const REGISTRY_SCRIPTS: RegistryItem[] = [
  {
    id: 'r2',
    name: 'Reduzir Input Lag USB',
    description:
      'Desativa a suspensão seletiva USB para evitar que dispositivos entrem em modo de economia.',
    scriptId: 'inputlag-5',
  },
  {
    id: 'r3',
    name: 'TCPNoDelay',
    description: 'Ativa TCPNoDelay para desabilitar o algoritmo Nagle, reduzindo latência de rede.',
    scriptId: 'inputlag-6',
  },
  {
    id: 'r4',
    name: 'Prioridade de Foreground',
    description: 'Ajusta Win32PrioritySeparation para priorizar aplicações em primeiro plano.',
    scriptId: 'inputlag-7',
  },
  {
    id: 'r5',
    name: 'Desativar LargeSystemCache',
    description:
      'Reduz o uso de memória pelo cache do sistema, liberando recursos para applications.',
    scriptId: 'inputlag-8',
  },
  {
    id: 'r6',
    name: 'Atraso no Menu',
    description: 'Remove o atraso de exibição de menus definindo MenuShowDelay como 0.',
    scriptId: 'inputlag-10',
  },
];

const HERO = {
  path: '/input-lag',
  badge: 'Otimização de Input',
  title: 'Reduza o Input Lag do seu PC',
  description:
    'Ajustes de registro e do sistema que reduzem a latência de resposta, USB e rede para uma experiência de jogo mais competitiva.',
  visual: <AnimatedInputLag />,
};

/** Só os ajustes curados entram na lista — o catálogo pode ter scripts de device. */
const curated = (scripts: ScriptEntry[]) => resolveCuratedItems(scripts, REGISTRY_SCRIPTS);
const transform = (scripts: ScriptEntry[]) => curated(scripts).map(({ script }) => script);

/** A lista usa os nomes e descrições curados do registry, não os do catálogo. */
const buildLabels = (scripts: ScriptEntry[]) =>
  Object.fromEntries(
    curated(scripts).map(({ item, script }) => [
      script.id,
      { name: item.name, description: item.description },
    ])
  );

export default function InputLagPage() {
  return (
    <TweaksPage
      category="Input Lag"
      hero={HERO}
      skeletonCount={4}
      skeletonGap="gap-3"
      transform={transform}
      buildLabels={buildLabels}
      compactToolbarGap
    />
  );
}
