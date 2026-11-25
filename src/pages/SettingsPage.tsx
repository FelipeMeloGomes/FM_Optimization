import { useEffect, useState } from 'react';
import { HeroBanner, HeroDescription } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageSkeleton } from '../components/PageSkeleton';
import { DataSection } from '../components/settings/DataSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { PageLockSection } from '../components/settings/PageLockSection';
import { PreferencesSection } from '../components/settings/PreferencesSection';
import { ThemeSection } from '../components/settings/ThemeSection';
import { UpdatesSection } from '../components/settings/UpdatesSection';
import { useSettingsContext } from '../contexts/SettingsContext';
import { HERO_ART } from '../lib/hero-art';

function SettingsHero() {
  return (
    <HeroBanner {...HERO_ART['/settings']}>
      <div className="relative p-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <RouteIcon path="/settings" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Configuracoes
            </span>
          </div>
          <h2 className="text-balance text-lg font-bold text-foreground">
            Preferencias do Sistema
          </h2>
          <HeroDescription text="Personalize o comportamento do FM Optimize." />
        </div>
      </div>
    </HeroBanner>
  );
}

export default function SettingsPage() {
  const [appVersion, setAppVersion] = useState('');
  const [packaged, setPackaged] = useState(false);
  const { loading } = useSettingsContext();

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion);
    window.electronAPI.isPackaged().then(setPackaged);
  }, []);

  return (
    <div className="space-y-6">
      <SettingsHero />
      {loading ? (
        <PageSkeleton layout="settings-page" hero="none" label="Carregando configurações…" />
      ) : (
        <>
          <ThemeSection />
          <PreferencesSection />
          <PageLockSection />
          <DataSection />
          <NotificationsSection />
          <UpdatesSection appVersion={appVersion} packaged={packaged} />
        </>
      )}
    </div>
  );
}
