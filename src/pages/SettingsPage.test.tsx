// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * Regressão do layout da página Configurações: os cards devem ocupar a largura
 * toda do container, empilhados em uma única coluna, sem limitação de largura
 * nem grade que deixe espaços vazios entre eles.
 */

const settings = {
  theme: 'dark',
  accentColor: '#22d3ee',
  confirmOnExecute: true,
  autoRestorePoint: true,
  soundEnabled: true,
  toastDuration: 'medium',
  pageLock: {
    enabled: false,
    salt: '',
    passwordHashCipher: '',
    lockedPages: [],
    unlocked: true,
  },
  adbPath: null,
  autoClean: {
    enabled: false,
    cleaners: [],
    frequency: 'weekly',
    weekday: 0,
    dayOfMonth: 1,
    time: '03:00',
    runOnStartup: false,
    catchUp: true,
    lastRunAt: null,
    nextRunAt: null,
    pending: [],
  },
  powerSaveMode: false,
};

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings,
    update: () => {},
    exportData: () => {},
    importData: () => {},
  }),
}));

vi.mock('../components/hero/AnimatedHero', () => ({
  AnimatedSettings: () => <div data-testid="animated-settings" />,
}));

const api = {
  getAppVersion: () => Promise.resolve('2.20.0'),
  isPackaged: () => Promise.resolve(false),
  onUpdateStatus: () => () => {},
};

vi.stubGlobal('window', {
  electronAPI: new Proxy(api, {
    get(target, prop) {
      return prop in target ? target[prop as keyof typeof target] : () => Promise.resolve(null);
    },
  }),
});

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('empilha os cards em uma coluna sem limitar a largura', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('<div class="space-y-6">');
    expect(html).not.toContain('max-w-lg');
    expect(html).not.toContain('lg:grid-cols-2');

    for (const title of [
      'Tema',
      'Preferencias',
      'Bloqueio de Paginas',
      'Dados',
      'Notificacoes',
      'Atualizacoes',
    ]) {
      expect(html).toContain(title);
    }
  });
});
