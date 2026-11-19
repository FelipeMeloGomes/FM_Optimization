import {
  Activity,
  Clock,
  Eraser,
  Gamepad2,
  Gauge,
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
    path: '/emuladores',
    label: 'Emuladores',
    icon: Gamepad2,
    category: 'ferramentas',
    protected: true,
    component: lazy(() => import('../pages/EmuladoresPage')),
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
    path: '/utilities',
    label: 'Utilitarios',
    icon: Wrench,
    category: 'ferramentas',
    protected: true,
    component: lazy(() => import('../pages/UtilitiesPage')),
  },
  {
    path: '/armazenamento',
    label: 'Armazenamento',
    icon: HardDrive,
    category: 'ferramentas',
    protected: true,
    component: lazy(() => import('../pages/StoragePage')),
  },
  {
    path: '/reparo-do-sistema',
    label: 'Reparo do sistema',
    icon: Hammer,
    category: 'ferramentas',
    protected: true,
    component: lazy(() => import('../pages/SystemRepairPage')),
  },
  {
    path: '/privacidade-seguranca',
    label: 'Privacidade',
    icon: ShieldCheck,
    category: 'ferramentas',
    protected: true,
    component: lazy(() => import('../pages/PrivacySecurityPage')),
  },
  // Cada periférico tem sua própria página na seção Sistema; os ids dos scripts
  // e o destino do Ctrl+K saem da mesma configuração usada pelas páginas.
  ...DEVICE_PAGES.map((device) => ({
    path: device.path,
    label: device.name,
    icon: device.icon,
    category: 'sistema' as const,
    protected: true,
    component: DEVICE_COMPONENTS[device.category],
  })),
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
