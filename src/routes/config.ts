import {
  Clock,
  Cpu,
  Eraser,
  Gamepad2,
  Gauge,
  Home,
  type LucideIcon,
  MonitorDown,
  MousePointerClick,
  PackageX,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Wifi,
  Wrench,
} from 'lucide-react';
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

export type CategoryId =
  | 'inicio'
  | 'desempenho'
  | 'manutencao'
  | 'programas'
  | 'rede'
  | 'ferramentas'
  | 'seguranca'
  | 'sistema';

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
  { id: 'programas', label: 'Programas', icon: Smartphone },
  { id: 'rede', label: 'Rede', icon: Wifi },
  { id: 'ferramentas', label: 'Ferramentas', icon: Wrench },
  { id: 'seguranca', label: 'Segurança', icon: ShieldCheck },
  { id: 'sistema', label: 'Sistema', icon: Settings },
];

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
    path: '/cpu',
    label: 'Processador',
    icon: Cpu,
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
    category: 'manutencao',
    protected: true,
    component: lazy(() => import('../pages/DebloatPage')),
  },
  {
    path: '/essenciais',
    label: 'Essenciais PC',
    icon: MonitorDown,
    category: 'programas',
    protected: true,
    component: lazy(() => import('../pages/EssentialsPage')),
  },
  {
    path: '/emuladores',
    label: 'Emuladores',
    icon: Gamepad2,
    category: 'programas',
    protected: true,
    component: lazy(() => import('../pages/EmuladoresPage')),
  },
  {
    path: '/rede',
    label: 'Rede',
    icon: Wifi,
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/NetworkPage')),
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
    path: '/privacidade-seguranca',
    label: 'Privacidade',
    icon: ShieldCheck,
    category: 'seguranca',
    protected: true,
    component: lazy(() => import('../pages/PrivacySecurityPage')),
  },
  {
    path: '/restore-points',
    label: 'Restauracao',
    icon: Shield,
    category: 'seguranca',
    component: lazy(() => import('../pages/RestorePointsPage')),
  },
  {
    path: '/history',
    label: 'Historico',
    icon: Clock,
    category: 'seguranca',
    component: lazy(() => import('../pages/HistoryPage')),
  },
  {
    path: '/settings',
    label: 'Configuracoes',
    icon: Settings,
    category: 'sistema',
    component: lazy(() => import('../pages/SettingsPage')),
  },
];

export function routesByCategory(id: CategoryId): AppRoute[] {
  return ROUTES.filter((route) => route.category === id);
}
