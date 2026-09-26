import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AppSettings } from '../../electron/shared/ipc-types';
import { getThemeById, THEMES } from '../lib/theme-config';

interface SettingsContextValue {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => void;
  loading: boolean;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT: AppSettings = {
  theme: 'dark',
  accentColor: '#22d3ee',
  confirmOnExecute: true,
  autoRestorePoint: true,
  cpuVendorOverride: null,
  security: {
    enableIpcValidation: true,
    enableDenyListBlock: false,
    enablePathValidation: true,
    enablePsSanitize: true,
  },
  pageLock: {
    enabled: true,
    salt: '',
    passwordHashCipher: '',
    lockedPages: ['/emuladores'],
    unlocked: false,
  },
  soundEnabled: true,
  toastDuration: 'medium',
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    window.electronAPI
      .getSettings()
      .then(setSettings)
      .catch((e) => console.error('Failed to load settings:', e))
      .finally(() => setLoading(false));
  }, []);

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement;
    const darkClassNames = THEMES.filter((t) => t.isDark).map((t) => t.id);
    root.classList.remove(...darkClassNames);
    const theme = getThemeById(settings.theme);
    if (theme.isDark) {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Apply accent color as CSS variables — full palette derivation
  useEffect(() => {
    const root = document.documentElement;
    const { h, s, l } = hexToHsl(settings.accentColor);

    // Core accent variables
    root.style.setProperty('--accent-h', String(h));
    root.style.setProperty('--accent-s', `${s}%`);
    root.style.setProperty('--accent-l', `${l}%`);

    // Generate full 50-900 palette
    const paletteLevels = [
      { key: '50', lightness: 95, satMult: 0.3 },
      { key: '100', lightness: 90, satMult: 0.4 },
      { key: '200', lightness: 80, satMult: 0.6 },
      { key: '300', lightness: 68, satMult: 0.8 },
      { key: '400', lightness: 55, satMult: 0.9 },
      { key: '500', lightness: l, satMult: 1 },
      { key: '600', lightness: Math.max(l - 10, 10), satMult: 1 },
      { key: '700', lightness: Math.max(l - 20, 8), satMult: 1.05 },
      { key: '800', lightness: Math.max(l - 30, 6), satMult: 1.1 },
      { key: '900', lightness: Math.max(l - 40, 5), satMult: 1.15 },
    ];

    for (const level of paletteLevels) {
      const sl = Math.min(Math.round(s * level.satMult), 100);
      root.style.setProperty(`--accent-${level.key}`, `hsl(${h}, ${sl}%, ${level.lightness}%)`);
    }

    // Override primary colors
    root.style.setProperty('--color-primary', `hsl(${h}, ${s}%, ${l}%)`);
    root.style.setProperty('--color-primary-foreground', l > 60 ? '#0a0b10' : '#ffffff');
    root.style.setProperty(
      '--color-accent',
      `hsl(${h}, ${Math.min(s + 10, 100)}%, ${Math.max(l - 15, 5)}%)`
    );
    root.style.setProperty('--color-accent-foreground', l > 60 ? '#0a0b10' : '#ffffff');
    root.style.setProperty('--color-ring', `hsl(${h}, ${s}%, ${l}%)`);
    root.style.setProperty('--color-sidebar-primary', `hsl(${h}, ${s}%, ${l}%)`);
    root.style.setProperty(
      '--color-sidebar-accent',
      `hsl(${h}, ${Math.min(s + 10, 100)}%, ${Math.max(l - 15, 5)}%)`
    );
  }, [settings.accentColor]);

  const update = useCallback((partial: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...partial };
    setSettings(next);
    window.electronAPI
      .saveSettings(next)
      .catch((e) => console.error('Failed to save settings:', e));
  }, []);

  const exportData = useCallback(async () => {
    const data = await window.electronAPI.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fm-optimize-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(async (file: File) => {
    const text = await file.text();
    await window.electronAPI.importData(text);
  }, []);

  const contextValue = useMemo(
    () => ({ settings, update, loading, exportData, importData }),
    [settings, update, loading, exportData, importData]
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
}
