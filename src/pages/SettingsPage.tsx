import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DataSection } from '../components/settings/DataSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { PageLockSection } from '../components/settings/PageLockSection';
import { PreferencesSection } from '../components/settings/PreferencesSection';
import { ThemeSection } from '../components/settings/ThemeSection';
import { UpdatesSection } from '../components/settings/UpdatesSection';
import { Badge } from '../components/ui';

export default function SettingsPage() {
  const [appVersion, setAppVersion] = useState('');
  const [packaged, setPackaged] = useState(false);

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion);
    window.electronAPI.isPackaged().then(setPackaged);
  }, []);

  return (
    <div className="space-y-6 max-w-lg">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Settings className="size-28 text-primary" aria-hidden="true" />
        </div>
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Settings className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Configuracoes
                </span>
              </div>
              <h2 className="text-balance text-lg font-bold text-foreground">
                Preferencias do Sistema
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Personalize o comportamento do FM Optimize.
              </p>
            </div>
            <Badge variant="secondary" className="px-3 py-1 text-xs">
              v{appVersion || '…'}
            </Badge>
          </div>
        </div>
      </div>

      <ThemeSection />
      <PreferencesSection />
      <PageLockSection />
      <DataSection />
      <NotificationsSection />
      <UpdatesSection appVersion={appVersion} packaged={packaged} />
    </div>
  );
}
