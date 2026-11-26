import { describe, expect, it } from 'vitest';
import { DEVICE_PAGES } from './device-pages';
import { NETWORK_SECTIONS } from './network-sections';
import { PERFORMANCE_SECTIONS } from './performance-sections';
import { PERSONALIZATION_SECTIONS } from './personalization-sections';
import { PRIVACY_SECTIONS } from './privacy-sections';
import { REPAIR_SECTIONS } from './repair-sections';
import { STORAGE_SECTIONS } from './storage-sections';
import { UTIL_SECTIONS } from './util-sections';

/**
 * As cores das seções são dados, não estilo inline: elas chegam ao
 * `ScriptSectionCard` e pintam borda, fundo e ícone. O guard de `.tsx` não via
 * esses arquivos, então uma paleta crua (`cyan-400`, `blue-500/10`...) passava
 * batido e ignorava a troca de tema. Aqui a regra é explícita: só token
 * semântico do `@theme`.
 */
interface ThemedSection {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor?: string;
}

const SECTION_GROUPS: Record<string, ThemedSection[]> = {
  device: DEVICE_PAGES,
  network: NETWORK_SECTIONS,
  performance: PERFORMANCE_SECTIONS,
  personalization: PERSONALIZATION_SECTIONS,
  privacy: PRIVACY_SECTIONS,
  repair: REPAIR_SECTIONS,
  storage: STORAGE_SECTIONS,
  util: UTIL_SECTIONS,
};

const THEME_CLASS =
  /^(?:text|bg|border)-(?:primary|accent|info|warning|success|destructive|muted|secondary)(?:\/\d+)?$/;

describe('cores das seções', () => {
  it.each(Object.entries(SECTION_GROUPS))('%s usa apenas tokens do tema', (_group, sections) => {
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      for (const field of ['color', 'bgColor', 'borderColor', 'dotColor'] as const) {
        const value = section[field];
        if (value === undefined) continue;
        expect(value, `${section.name}.${field} = ${value}`).toMatch(THEME_CLASS);
      }
    }
  });
});
