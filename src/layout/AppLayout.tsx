import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { CommandPalette } from '../components/CommandPalette';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useCommandPalette } from '../hooks/use-command-palette';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useScriptExecutionToast } from '../hooks/use-script-execution-toast';
import { useUpdateToast } from '../hooks/use-update-toast';
import { getThemeById } from '../lib/theme-config';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function AppLayout() {
  const { settings } = useSettingsContext();
  const { isOpen, open, close } = useCommandPalette();
  useUpdateToast();
  useScriptExecutionToast();
  useKeyboardShortcuts();

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Toaster
        position="bottom-right"
        theme={getThemeById(settings.theme).isDark ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: 'var(--color-card)',
            color: 'var(--color-foreground)',
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius)',
          },
        }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteudo
      </a>
      <header>
        <TitleBar />
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar openCommandPalette={open} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main id="main-content" className="flex-1 overflow-y-auto overscroll-contain p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette isOpen={isOpen} onClose={close} />
    </div>
  );
}
