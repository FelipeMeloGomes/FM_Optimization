import { Keyboard, type LucideIcon, Monitor, Mouse } from 'lucide-react';

export type DeviceCategory = 'Mouse' | 'Monitor' | 'Teclado';

export interface DevicePageConfig {
  path: string;
  name: string;
  category: DeviceCategory;
  heroDescription: string;
  description: string;
  icon: LucideIcon;
  color: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  scriptIds: string[];
  whatItOptimizes: string[];
}

/** Configuração única das três páginas de periféricos da seção Sistema. */
export const MOUSE_PAGE: DevicePageConfig = {
  path: '/mouse',
  name: 'Mouse',
  category: 'Mouse',
  heroDescription:
    'Desative a aceleração e obtenha movimento 1:1, com tracking consistente em jogos.',
  description: 'Desative aceleração e obtenha movimento 1:1 preciso.',
  icon: Mouse,
  color: 'text-warning',
  dotColor: 'bg-warning',
  bgColor: 'bg-warning/10',
  borderColor: 'border-warning/20',
  scriptIds: ['inputlag-2', 'inputlag-11'],
  whatItOptimizes: [
    'Aceleração do mouse desativada',
    'Movimento 1:1 precisão absoluta',
    'Tracking consistente em jogos',
  ],
};

export const MONITOR_PAGE: DevicePageConfig = {
  path: '/monitor',
  name: 'Monitor',
  category: 'Monitor',
  heroDescription: 'Reduza a latência entre a GPU e a tela para ver cada quadro mais rápido.',
  description: 'Minimize a latência de tolerância do driver de vídeo.',
  icon: Monitor,
  color: 'text-primary',
  dotColor: 'bg-primary',
  bgColor: 'bg-primary/10',
  borderColor: 'border-primary/20',
  scriptIds: ['inputlag-3'],
  whatItOptimizes: [
    'Tolerância DXGKrnl reduzida',
    'Menor latência de renderização',
    'Quadros exibidos mais rápido',
  ],
};

export const TECLADO_PAGE: DevicePageConfig = {
  path: '/teclado',
  name: 'Teclado',
  category: 'Teclado',
  heroDescription: 'Teclas com resposta instantânea e sem atraso na digitação.',
  description: 'Reduza a latência de digitação e resposta instantânea de teclas.',
  icon: Keyboard,
  color: 'text-info',
  dotColor: 'bg-info',
  bgColor: 'bg-info/10',
  borderColor: 'border-info/20',
  scriptIds: ['inputlag-1', 'inputlag-9'],
  whatItOptimizes: [
    'KeyboardDelay reduzido a zero',
    'Resposta instantânea de teclas',
    'Remoção de atraso de menu',
  ],
};

export const DEVICE_PAGES: DevicePageConfig[] = [MOUSE_PAGE, MONITOR_PAGE, TECLADO_PAGE];
