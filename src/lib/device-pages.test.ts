import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';
import { DEVICE_PAGES, MONITOR_PAGE, MOUSE_PAGE, TECLADO_PAGE } from './device-pages';

const scripts = JSON.parse(
  readFileSync(new URL('../../resources/scripts.json', import.meta.url), 'utf-8')
) as ScriptEntry[];

describe('páginas de dispositivo', () => {
  it('define uma página por periférico na seção Sistema', () => {
    expect(DEVICE_PAGES).toEqual([MOUSE_PAGE, MONITOR_PAGE, TECLADO_PAGE]);
    expect(DEVICE_PAGES.map((page) => page.path)).toEqual(['/mouse', '/monitor', '/teclado']);
    expect(DEVICE_PAGES.map((page) => page.category)).toEqual(['Mouse', 'Monitor', 'Teclado']);
    expect(DEVICE_PAGES.map((page) => page.name)).toEqual(['Mouse', 'Monitor', 'Teclado']);
  });

  it('cada página contém exatamente os scripts do seu periférico', () => {
    expect(MOUSE_PAGE.scriptIds).toEqual(['inputlag-2', 'inputlag-11']);
    expect(MONITOR_PAGE.scriptIds).toEqual(['inputlag-3']);
    expect(TECLADO_PAGE.scriptIds).toEqual(['inputlag-1', 'inputlag-9']);
  });

  it('todo script das páginas existe no catálogo com a categoria da página', () => {
    for (const page of DEVICE_PAGES) {
      for (const id of page.scriptIds) {
        const script = scripts.find((s) => s.id === id);
        expect(script, id).toBeDefined();
        expect(script?.category, id).toBe(page.category);
      }
    }
  });

  it('nenhum script de dispositivo ficou na categoria Input Lag', () => {
    const deviceIds = DEVICE_PAGES.flatMap((page) => page.scriptIds);
    const stray = scripts
      .filter((script) => deviceIds.includes(script.id) && script.category === 'Input Lag')
      .map((script) => script.id);
    expect(stray).toEqual([]);
  });
});

describe('fotos reais dos banners', () => {
  it('usa o PRO X SuperLight 2 preto no banner do Mouse', () => {
    expect(MOUSE_PAGE.heroImage).toContain('mouse-superlight2-black');
    expect(MOUSE_PAGE.heroImageAlt).toBe('Mouse gamer Logitech PRO X SuperLight 2 Black');
  });

  it('usa fotos de teclado e monitor gamer nos banners', () => {
    expect(TECLADO_PAGE.heroImage).toContain('keyboard-gamer');
    expect(TECLADO_PAGE.heroImageAlt).toBe('Teclado gamer Razer Ornata Chroma');
    expect(MONITOR_PAGE.heroImage).toContain('monitor-gamer');
    expect(MONITOR_PAGE.heroImageAlt).toBe('Monitor gamer');
  });
});
