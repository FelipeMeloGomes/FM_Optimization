import {
  Activity,
  CircuitBoard,
  Clock,
  Crosshair,
  Eraser,
  Gamepad2,
  Gauge,
  GitCompareArrows,
  Globe,
  Hammer,
  HardDrive,
  Home,
  type LucideIcon,
  MonitorDown,
  MousePointerClick,
  PackageX,
  Palette,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  Wifi,
  Wrench,
} from 'lucide-react';
import { DEVICE_PAGES } from '../lib/device-pages';

/**
 * Ícone de cada entrada da sidebar, indexado pelo path da rota.
 *
 * `config.ts`, os badges dos heroes e o visual animado consomem este mesmo
 * mapa. Assim, trocar o ícone de uma rota atualiza a sidebar e o hero juntos.
 */
export const ROUTE_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/input-lag': MousePointerClick,
  '/cpu': Gauge,
  '/inicializacao': Rocket,
  '/cleaner': Eraser,
  '/debloat': PackageX,
  '/essenciais': MonitorDown,
  '/rede': Wifi,
  '/dns': Globe,
  '/velocidade': Activity,
  '/comparar-placa': GitCompareArrows,
  '/overlay-jogo': Crosshair,
  '/armazenamento': HardDrive,
  '/emuladores': Gamepad2,
  '/meu-pc': CircuitBoard,
  '/privacidade-seguranca': ShieldCheck,
  '/reparo-do-sistema': Hammer,
  '/utilities': Wrench,
  '/restore-points': Shield,
  '/history': Clock,
  '/personalizacao': Palette,
  '/settings': Settings,
  ...Object.fromEntries(DEVICE_PAGES.map((device) => [device.path, device.icon])),
};

export function getRouteIcon(path: string): LucideIcon {
  const icon = ROUTE_ICONS[path];

  if (!icon) throw new Error(`Ícone de rota não definido: ${path}`);

  return icon;
}
