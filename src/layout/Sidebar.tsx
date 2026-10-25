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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Smartphone,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useSettingsContext } from '../contexts/SettingsContext';
import { isPageLocked } from '../lib/page-lock';
import { getThemeById } from '../lib/theme-config';
import { cn } from '../lib/utils';

interface SidebarProps {
  openCommandPalette: () => void;
}

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
}

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/tweaks', icon: Gauge, label: 'Ajustes' },
  { to: '/utilities', icon: Wrench, label: 'Utilitarios' },
  { to: '/cleaner', icon: Eraser, label: 'Limpeza' },
  { to: '/rede', icon: Wifi, label: 'Rede' },
  { to: '/input-lag', icon: MousePointerClick, label: 'Input Lag' },
  { to: '/cpu', icon: Cpu, label: 'Processador' },
  { to: '/apps', icon: Smartphone, label: 'Aplicativos' },
  { to: '/debloat', icon: PackageX, label: 'Debloat' },
  { to: '/essenciais', icon: MonitorDown, label: 'Essenciais PC' },
  { to: '/emuladores', icon: Gamepad2, label: 'Emuladores' },
] as const;

const systemItems = [
  { to: '/restore-points', icon: Shield, label: 'Restauracao' },
  { to: '/history', icon: Clock, label: 'Historico' },
] as const;

const bottomItems = [{ to: '/settings', icon: Settings, label: 'Configuracoes' }] as const;

function SidebarLink({ to, icon: Icon, label, collapsed }: SidebarLinkProps) {
  const link = (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
          isActive
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'size-9 justify-center px-0 gap-0'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
          )}
          <Icon
            className="size-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
            aria-hidden="true"
          />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );

  // Portal do Radix: o tooltip nao e cortado pelo scroll da navegacao.
  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ openCommandPalette }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useSettingsContext();
  const theme = getThemeById(settings.theme);
  const glowColor = theme.signature?.glowColor;

  const visibleNavItems = navItems.filter((item) => !isPageLocked(item.to, settings));
  const visibleSystemItems = systemItems.filter((item) => !isPageLocked(item.to, settings));

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex min-h-0 flex-col gap-2 overflow-hidden border-r border-border bg-sidebar-background px-3 py-4 transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-48'
        )}
      >
        <div
          className={cn(
            'mb-4 flex shrink-0 items-center',
            collapsed ? 'justify-center' : 'justify-start'
          )}
        >
          <img
            src={logoUrl}
            alt="FM Optimize"
            className={cn(
              'object-contain transition-all duration-300',
              glowColor
                ? `drop-shadow-[0_0_8px_${glowColor}]`
                : 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]',
              collapsed ? 'size-8' : 'size-10'
            )}
          />
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground',
            collapsed && 'size-9 justify-center px-0 gap-0'
          )}
        >
          <Search className="size-4 shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            Buscar
          </span>
          {!collapsed && (
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Ctrl+K
            </kbd>
          )}
        </button>
        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1',
            // Sem scrollbar: numa sidebar estreita ela rouba a largura dos icones.
            collapsed && '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {visibleNavItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
          <div className="my-2 border-t border-border" />
          {visibleSystemItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <nav className="flex shrink-0 flex-col gap-1 border-t border-border pt-2">
          {bottomItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground',
            collapsed && 'size-9 justify-center px-0 gap-0'
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            Recolher
          </span>
        </button>
      </aside>
    </TooltipProvider>
  );
}
