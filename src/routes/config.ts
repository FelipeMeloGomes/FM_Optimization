import {
  Eraser,
  Home,
  type LucideIcon,
  Mouse,
  Settings,
  Sparkles,
  Wifi,
  Wrench,
} from 'lucide-react';
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import { DEVICE_PAGES, type DeviceCategory } from '../lib/device-pages';
import { getRouteIcon } from './route-icons';

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

type RouteInput = Omit<AppRoute, 'icon'>;

/**
 * Toda rota recebe o ícone da sidebar automaticamente. Nenhuma página ou
 * configuração escolhe o ícone na mão: basta o path, e `getRouteIcon` resolve.
 */
function route({ path, ...rest }: RouteInput): AppRoute {
  return { path, icon: getRouteIcon(path), ...rest };
}

export const CATEGORIES: Category[] = [
  { id: 'inicio', label: 'Inicio', hideLabel: true, icon: Home },
  { id: 'desempenho', label: 'Desempenho', icon: getRouteIcon('/cpu') },
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
  ...DEVICE_PAGES.map((device) =>
    route({
      path: device.path,
      label: device.name,
      category: 'sistema',
      protected: true,
      component: DEVICE_COMPONENTS[device.category],
    })
  ),
  route({
    path: '/armazenamento',
    label: 'Armazenamento',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/StoragePage')),
  }),
  route({
    path: '/emuladores',
    label: 'Emuladores',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/EmuladoresPage')),
  }),
  route({
    path: '/meu-pc',
    label: 'Meu PC',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/MeuPcPage')),
  }),
  route({
    path: '/privacidade-seguranca',
    label: 'Privacidade',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/PrivacySecurityPage')),
  }),
  route({
    path: '/reparo-do-sistema',
    label: 'Reparo do sistema',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/SystemRepairPage')),
  }),
  route({
    path: '/utilities',
    label: 'Utilitarios',
    category: 'sistema',
    protected: true,
    component: lazy(() => import('../pages/UtilitiesPage')),
  }),
].sort((a, b) => sistemaOrder(a) - sistemaOrder(b) || a.label.localeCompare(b.label, 'pt-BR'));

export const ROUTES: AppRoute[] = [
  route({
    path: '/',
    label: 'Inicio',
    category: 'inicio',
    component: lazy(() => import('../pages/DashboardPage')),
  }),
  route({
    path: '/input-lag',
    label: 'Input Lag',
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/InputLagPage')),
  }),
  // A rota continua /cpu para nao quebrar Page Lock nem links antigos, mas a
  // pagina cobre processador, GPU AMD e ajustes do Windows: o rotulo segue o
  // conteudo real, nao a rota.
  route({
    path: '/cpu',
    label: 'Otimização do Sistema',
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/CpuPage')),
  }),
  route({
    path: '/inicializacao',
    label: 'Inicializacao',
    category: 'desempenho',
    protected: true,
    component: lazy(() => import('../pages/StartupPage')),
  }),
  route({
    path: '/cleaner',
    label: 'Limpeza',
    category: 'manutencao',
    protected: true,
    component: lazy(() => import('../pages/CleanerPage')),
  }),
  route({
    path: '/debloat',
    label: 'Debloat',
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/DebloatPage')),
  }),
  route({
    path: '/essenciais',
    label: 'Essenciais PC',
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/EssentialsPage')),
  }),
  route({
    path: '/rede',
    label: 'Internet',
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/NetworkPage')),
  }),
  route({
    path: '/dns',
    label: 'DNS',
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/DnsPage')),
  }),
  route({
    path: '/velocidade',
    label: 'Velocidade',
    category: 'rede',
    protected: true,
    component: lazy(() => import('../pages/SpeedTestPage')),
  }),
  route({
    path: '/comparar-placa',
    label: 'Comparar Placas',
    category: 'ferramentas',
    component: lazy(() => import('../pages/CompararPlacaPage')),
  }),
  route({
    path: '/overlay-jogo',
    label: 'Overlay de jogo',
    category: 'ferramentas',
    component: lazy(() => import('../pages/OverlayJogoPage')),
  }),
  ...SYSTEM_ROUTES,
  // Restauracao e historico nao protegem nada: apenas registram/recuperam o
  // estado anterior. Ficam no rodape, em Configuracoes.
  route({
    path: '/restore-points',
    label: 'Restauracao',
    category: 'configuracoes',
    component: lazy(() => import('../pages/RestorePointsPage')),
  }),
  route({
    path: '/history',
    label: 'Historico',
    category: 'configuracoes',
    component: lazy(() => import('../pages/HistoryPage')),
  }),
  route({
    path: '/personalizacao',
    label: 'Personalização',
    category: 'formatacao',
    protected: true,
    component: lazy(() => import('../pages/PersonalizationPage')),
  }),
  route({
    path: '/settings',
    label: 'Configuracoes',
    category: 'configuracoes',
    component: lazy(() => import('../pages/SettingsPage')),
  }),
];

export function routesByCategory(id: CategoryId): AppRoute[] {
  return ROUTES.filter((route) => route.category === id);
}
