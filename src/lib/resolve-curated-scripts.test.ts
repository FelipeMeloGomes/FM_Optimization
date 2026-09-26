import { describe, expect, it } from 'vitest';
import { countCuratedScripts, resolveCuratedItems } from './resolve-curated-scripts';

interface FakeScript {
  id: string;
  subcategory: string;
}

// Mirrors category "Input Lag" in resources/scripts.json. Nine of these carry
// subcategory "Regedit", but inputlag-9 (keyboard) and inputlag-11 (mouse) are
// presented by the page under the device cards instead of the registry list.
const CATALOG: FakeScript[] = [
  { id: 'inputlag-1', subcategory: 'Teclado' },
  { id: 'inputlag-2', subcategory: 'Mouse' },
  { id: 'inputlag-3', subcategory: 'Monitor' },
  { id: 'inputlag-4', subcategory: 'Regedit' },
  { id: 'inputlag-5', subcategory: 'Regedit' },
  { id: 'inputlag-6', subcategory: 'Regedit' },
  { id: 'inputlag-7', subcategory: 'Regedit' },
  { id: 'inputlag-8', subcategory: 'Regedit' },
  { id: 'inputlag-9', subcategory: 'Regedit' },
  { id: 'inputlag-10', subcategory: 'Regedit' },
  { id: 'inputlag-11', subcategory: 'Regedit' },
  { id: 'inputlag-12', subcategory: 'Regedit' },
];

// Mirrors REGISTRY_SCRIPTS in InputLagPage.tsx.
const REGISTRY_ITEMS = [
  { id: 'r1', scriptId: 'inputlag-4' },
  { id: 'r2', scriptId: 'inputlag-5' },
  { id: 'r3', scriptId: 'inputlag-6' },
  { id: 'r4', scriptId: 'inputlag-7' },
  { id: 'r5', scriptId: 'inputlag-8' },
  { id: 'r6', scriptId: 'inputlag-10' },
  { id: 'r7', scriptId: 'inputlag-12' },
];

// Mirrors DEVICE_CARDS scriptIds in InputLagPage.tsx.
const DEVICE_GROUPS = [['inputlag-1', 'inputlag-9'], ['inputlag-2', 'inputlag-11'], ['inputlag-3']];

describe('resolveCuratedItems', () => {
  it('counts the curated list rather than the Regedit subcategory bucket', () => {
    // The bucket the badge used to read: 9, while only 7 cards rendered.
    expect(CATALOG.filter((s) => s.subcategory === 'Regedit')).toHaveLength(9);

    const resolved = resolveCuratedItems(CATALOG, REGISTRY_ITEMS);
    expect(resolved).toHaveLength(7);
  });

  it('keeps the curated order and pairs each item with its script', () => {
    const resolved = resolveCuratedItems(CATALOG, REGISTRY_ITEMS);

    expect(resolved.map((r) => r.item.id)).toEqual(REGISTRY_ITEMS.map((i) => i.id));
    expect(resolved.every((r) => r.script.id === r.item.scriptId)).toBe(true);
  });

  it('drops a curated item whose script is absent, so list and count agree', () => {
    const withGhost = [...REGISTRY_ITEMS, { id: 'r8', scriptId: 'inputlag-999' }];
    const resolved = resolveCuratedItems(CATALOG, withGhost);

    expect(resolved).toHaveLength(7);
    expect(resolved.some((r) => r.item.id === 'r8')).toBe(false);
  });
});

describe('countCuratedScripts', () => {
  it('sums every device group instead of the non-Regedit bucket', () => {
    // The bucket the devices badge used to read: 3, while 5 cards rendered.
    expect(CATALOG.filter((s) => s.subcategory !== 'Regedit')).toHaveLength(3);

    expect(countCuratedScripts(CATALOG, DEVICE_GROUPS)).toBe(5);
  });

  it('ignores ids that are not in the catalog', () => {
    expect(countCuratedScripts(CATALOG, [['inputlag-1', 'inputlag-404']])).toBe(1);
  });
});
