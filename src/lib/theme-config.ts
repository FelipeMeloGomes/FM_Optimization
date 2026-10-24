import type { AppSettings } from '../../electron/shared/ipc-types';
import { BatmanBackground } from '../components/BatmanBackground';

export interface ThemeConfig {
  id: AppSettings['theme'];
  name: string;
  description: string;
  cssSelector: string;
  isDark: boolean;
  preview: {
    bg: string;
    card: string;
    accent: string;
    text: string;
  };
  icon?: React.ComponentType<{ className?: string }>;
  backgroundComponent?: React.ComponentType;
  signature?: {
    glowColor: string;
    particleCount?: number;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Paper',
    description: 'Documentacao tecnica',
    cssSelector: ':root',
    isDark: false,
    preview: { bg: '#f0f2f7', card: '#ffffff', accent: '#0d9488', text: '#1a1d28' },
  },
  {
    id: 'dark',
    name: 'Terminal',
    description: 'Monitor de sistema',
    cssSelector: ':root.dark',
    isDark: true,
    preview: { bg: '#0c1222', card: '#151d2e', accent: '#22d3ee', text: '#d4dae5' },
  },
  {
    id: 'midnight',
    name: 'Deep Space',
    description: 'Notte contemplativa',
    cssSelector: ':root.midnight',
    isDark: true,
    preview: { bg: '#0a0a1a', card: '#12122a', accent: '#a78bfa', text: '#c8c8d8' },
  },
  {
    id: 'amber',
    name: 'Forge',
    description: 'Metal aquecido',
    cssSelector: ':root.amber',
    isDark: true,
    preview: { bg: '#1a1410', card: '#241e18', accent: '#fbbf24', text: '#e8e0d4' },
  },
  {
    id: 'emerald',
    name: 'Matrix',
    description: 'Chuva digital',
    cssSelector: ':root.emerald',
    isDark: true,
    preview: { bg: '#0a1a14', card: '#0f2820', accent: '#34d399', text: '#d0f0e0' },
  },
  {
    id: 'batman',
    name: 'Gotham Noir',
    description: 'Film noir gotico',
    cssSelector: ':root.batman',
    isDark: true,
    preview: { bg: '#08080e', card: '#10101a', accent: '#d4a017', text: '#e0dcd4' },
    backgroundComponent: BatmanBackground,
    signature: {
      glowColor: 'rgba(201, 162, 39, 0.6)',
      particleCount: 20,
    },
  },
];

export function getThemeById(id: AppSettings['theme']): ThemeConfig {
  return THEMES.find((t) => t.id === id) ?? THEMES[1];
}
