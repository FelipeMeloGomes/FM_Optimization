import cleanupImage from '../assets/cleaner-hero.svg';
import compararPlacaImage from '../assets/comparar-placa-hero.svg';
import cpuImage from '../assets/cpu-hero.svg';
import dashboardImage from '../assets/dashboard-hero.svg';
import debloatImage from '../assets/debloat-hero.svg';
import dnsImage from '../assets/dns-hero.svg';
import emuladoresImage from '../assets/emuladores-hero.svg';
import essentialsImage from '../assets/essentials-hero.svg';
import historyImage from '../assets/history-hero.svg';
import inputLagImage from '../assets/input-lag-hero.svg';
import meuPcImage from '../assets/meu-pc-hero.svg';
import networkImage from '../assets/network-hero.svg';
import nvmeImage from '../assets/nvme-hero.svg';
import optimizePcImage from '../assets/optimize-pc-hero.svg';
import overlayJogoImage from '../assets/overlay-jogo-hero.svg';
import personalizationImage from '../assets/personalization-hero.svg';
import privacyImage from '../assets/privacy-hero.svg';
import repairImage from '../assets/repair-hero.svg';
import restorePointsImage from '../assets/restore-points-hero.svg';
import settingsImage from '../assets/settings-hero.svg';
import speedTestImage from '../assets/speedtest-hero.svg';
import startupImage from '../assets/startup-hero.svg';
import utilitiesImage from '../assets/utilities-hero.svg';
import { MONITOR_PAGE, MOUSE_PAGE, TECLADO_PAGE } from './device-pages';

export interface HeroArt {
  image: string;
  imageAlt: string;
}

/** Ilustração de topo de cada rota, centralizada para todas as páginas. */
export const HERO_ART: Record<string, HeroArt> = {
  [MOUSE_PAGE.path]: { image: MOUSE_PAGE.heroImage, imageAlt: MOUSE_PAGE.heroImageAlt },
  [TECLADO_PAGE.path]: { image: TECLADO_PAGE.heroImage, imageAlt: TECLADO_PAGE.heroImageAlt },
  [MONITOR_PAGE.path]: { image: MONITOR_PAGE.heroImage, imageAlt: MONITOR_PAGE.heroImageAlt },
  '/': {
    image: dashboardImage,
    imageAlt: 'Ilustração de painel de instrumentos com mostradores e LEDs',
  },
  '/otimizar-pc': {
    image: optimizePcImage,
    imageAlt: 'Ilustração de cooler de processador com ventoinha RGB',
  },
  '/cleaner': {
    image: cleanupImage,
    imageAlt: 'Ilustração de lata de ar comprimido com bico e jato',
  },
  '/debloat': {
    image: debloatImage,
    imageAlt: 'Ilustração de HD externo com cabo e etiquetas',
  },
  '/essenciais': {
    image: essentialsImage,
    imageAlt: 'Ilustração de kit de ferramentas sobre placa-mãe',
  },
  '/inicializacao': {
    image: startupImage,
    imageAlt: 'Ilustração de fonte de alimentação com chave e cabos',
  },
  '/dns': {
    image: dnsImage,
    imageAlt: 'Ilustração de servidor rack com portas e LEDs',
  },
  '/velocidade': {
    image: speedTestImage,
    imageAlt: 'Ilustração de cabo Ethernet com conector RJ45',
  },
  '/comparar-placa': {
    image: compararPlacaImage,
    imageAlt: 'Ilustração de duas placas de vídeo lado a lado',
  },
  '/overlay-jogo': {
    image: overlayJogoImage,
    imageAlt: 'Ilustração de headset gamer com microfone',
  },
  '/emuladores': {
    image: emuladoresImage,
    imageAlt: 'Ilustração de console retrô com dois controles',
  },
  '/history': {
    image: historyImage,
    imageAlt: 'Ilustração de arquivo de gavetas com pastas',
  },
  '/restore-points': {
    image: restorePointsImage,
    imageAlt: 'Ilustração de HD externo de backup com etiqueta',
  },
  '/settings': {
    image: settingsImage,
    imageAlt: 'Ilustração de console de ajustes com botões e LEDs',
  },
  '/cpu': {
    image: cpuImage,
    imageAlt: 'Ilustração de processador em soquete com dissipador',
  },
  '/input-lag': {
    image: inputLagImage,
    imageAlt: 'Ilustração de gamepad gamer com fio e botões',
  },
  '/rede': {
    image: networkImage,
    imageAlt: 'Ilustração de roteador Wi-Fi com antenas e LEDs',
  },
  '/personalizacao': {
    image: personalizationImage,
    imageAlt: 'Ilustração de hub RGB com botões e cabos',
  },
  '/privacidade-seguranca': {
    image: privacyImage,
    imageAlt: 'Ilustração de cofre com fechadura digital',
  },
  '/reparo-do-sistema': {
    image: repairImage,
    imageAlt: 'Ilustração de ferro de solda e placa em bancada',
  },
  '/utilities': {
    image: utilitiesImage,
    imageAlt: 'Ilustração de multitool com chaves e pontas',
  },
  '/meu-pc': {
    image: meuPcImage,
    imageAlt: 'Ilustração de gabinete de PC desktop com iluminação RGB',
  },
  '/armazenamento': {
    image: nvmeImage,
    imageAlt: 'Ilustração de SSD NVMe M.2 com chips e contatos dourados',
  },
};

export function heroArt(path: string): HeroArt | undefined {
  return HERO_ART[path];
}
