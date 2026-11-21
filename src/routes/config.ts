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
  Mouse,
  MousePointerClick,
  PackageX,
  Palette,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Wifi,
  Wrench,
} from 'lucide-react';
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import { DEVICE_PAGES, type DeviceCategory } from '../lib/device-pages';

export type CategoryId =
  | 'inicio'
  | 'desempenho'
  | 'manutencao'
  | 'formatacao'
  | 'rede'
  | 'ferramentas'
  | 'sistema'
  | 'configuracoes';

export interface Category {
  id: CategoryId;
  label: string;
  hideLabel?: boolean;
  icon?: LucideIcon;
}

export interface AppRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  category: CategoryId;
  component: LazyExoticComponent<ComponentType>;
  protected?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'inicio', label: 'Inicio', hideLabel: true, icon: Home },
  { id: 'desempenho', label: 'Desempenho', icon: Gauge },
  { id: 'manutencao', label: 'Manutencao', icon: Eraser },
  { id: 'formatacao', label: 'Formatação', icon: Sparkles },
  { id: 'rede', label: 'Rede', icon: Wifi },
  { id: 'ferramentas', label: 'Ferramentas', icon: Wrench },
  { id: 'sistema', label: 'Sistema', icon: Mouse },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

const DEVICE_COMPONENTS: Record<DeviceCategory, LazyExoticComponent<ComponentType>> = {
  Mouse: lazy(() => import('../pages/MousePage')),
  Monitor: lazy(() => import('../pages/MonitorPage')),
  Teclado: lazy(() => import('../pages/KeyboardPage')),
};

/**
 * Os itens utilitários migraram para Sistema; Ferramentas volta a abrigar o
 * comparador de placas. Meu PC e os periféricos vêm primeiro, nessa ordem; os
 * demais seguem em ordem alfabética. A sequência é única para que sidebar,
 * Ctrl+K e Page Lock vejam o mesmo arranjo.
 */
const SISTEMA_LEADING_PATHS = ['/meu-pc', '/monitor', '/mouse', '/teclado'];

function sistemaOrder(route: AppRoute): number {
  const index = SISTEMA_LEADING_PATHS.indexOf(route.path);
  return index === -1 ? SISTEMA_LEADING_PATHS.length : index;
}

const SYSTEM_ROUTES: AppRoute[] = [
  ...DEVICE_PAGES.map((device) => ({
    path: device.path,
    label: device.name,
    icon: device.icon,
    category: 'sistema' as const,
    protected: true,
    component: DEVICE_COMPONENTS[device.category],
  })),
  {
    path: '/armazenamento',
    label: 'Armazenamento',
    icon: HardDrive,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/StoragePage')),
  },
  {
    path: '/emuladores',
    label: 'Emuladores',
    icon: Gamepad2,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/EmuladoresPage')),
  },
  {
    path: '/meu-pc',
    label: 'Meu PC',
    icon: CircuitBoard,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/MeuPcPage')),
  },
  {
    path: '/privacidade-seguranca',
    label: 'Privacidade',
    icon: ShieldCheck,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/PrivacySecurityPage')),
  },
  {
    path: '/reparo-do-sistema',
    label: 'Reparo do sistema',
    icon: Hammer,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/SystemRepairPage')),
  },
  {
    path: '/utilities',
    label: 'Utilitarios',
    icon: Wrench,
    category: 'sistema' as const,
    protected: true,
    component: lazy(() => import('../pages/UtilitiesPage')),
  },
].sort((a, b) => sistemaOrder(a) - sistemaOrder(b) || a.label.localeCompare(b.label, 'pt-BR'));

export const ROUTES: AppRoute[] = [
  {
    path: '/',
    label: 'Inicio',
    icon: Home,
    category: 'inicio',
    component: lazy(() => import('../pages/DashboardPage')),
  },
  {
    path: '/input-lag',
    label: 'Input Lag',
    icon: MousePointerClick,
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/InputLagPage')),
  },
  {
    // A rota continua /cpu para nao quebrar Page Lock nem links antigos, mas a
    // pagina cobre processador, GPU AMD e ajustes do Windows: o rotulo segue o
    // conteudo real, nao a rota.
    path: '/cpu',
    label: 'Otimização do Sistema',
    icon: Gauge,
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/CpuPage')),
  },
  {
    path: '/inicializacao',
    label: 'Inicializacao',
    icon: Rocket,
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/StartupPage')),
  },
  {
    path: '/cleaner',
    label: 'Limpeza',
    icon: Eraser,
    category: 'manutencao',
    protected: true,
    component: lazy(() => import('../pages/CleanerPage')),
  },
  {
    path: '/debloat',
    label: 'Debloat',
    icon: PackageX,
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/DebloatPage')),
  },
  {
    path: '/essenciais',
    label: 'Essenciais PC',
    icon: MonitorDown,
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/EssentialsPage')),
  },
  {
    path: '/rede',
    label: 'Internet',
    icon: Wifi,
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/NetworkPage')),
  },
  {
    path: '/dns',
    label: 'DNS',
    icon: Globe,
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/DnsPage')),
  },
  {
    path: '/velocidade',
    label: 'Velocidade',
    icon: Activity,
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/SpeedTestPage')),
  },
  {
    path: '/comparar-placa',
    label: 'Comparar Placas',
    icon: GitCompareArrows,
    category: 'ferramentas',
    component: lazy(() => import('../pages/CompararPlacaPage')),
  },
  {
    path: '/overlay-jogo',
    label: 'Overlay de jogo',
    icon: Crosshair,
    category: 'ferramentas',
    component: lazy(() => import('../pages/OverlayJogoPage')),
  },
  ...SYSTEM_ROUTES,
  {
    // Restauracao e historico nao protegem nada: apenas registram/recuperam o
    // estado anterior. Ficam no rodape, em Configuracoes.
    path: '/restore-points',
    label: 'Restauracao',
    icon: Shield,
    category: 'configuracoes',
    component: lazy(() => import('../pages/RestorePointsPage')),
  },
  {
    path: '/history',
    label: 'Historico',
    icon: Clock,
    category: 'configuracoes',
    component: lazy(() => import('../pages/HistoryPage')),
  },
  {
    path: '/personalizacao',
    label: 'Personalização',
    icon: Palette,
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/PersonalizationPage')),
  },
  {
    path: '/settings',
    label: 'Configuracoes',
    icon: Settings,
    category: 'configuracoes',
    component: lazy(() => import('../pages/SettingsPage')),
  },
];

export function routesByCategory(id: CategoryId): AppRoute[] {
  return ROUTES.filter((route) => route.category === id);
}
