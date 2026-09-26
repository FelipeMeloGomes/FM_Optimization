export interface HasScriptId {
  id: string;
}

export interface RefersToScript {
  scriptId: string;
}

/**
 * Pairs each curated item with its script, dropping items whose script is not
 * in the catalog.
 *
 * Count the resolved list rather than filtering the catalog by subcategory: a
 * page's curated list decides what it shows and how it is grouped, while a
 * catalog bucket is free to hold scripts the page presents somewhere else.
 * Counting the catalog made the two disagree.
 */
export function resolveCuratedItems<T extends HasScriptId, R extends RefersToScript>(
  scripts: readonly T[],
  items: readonly R[]
): { item: R; script: T }[] {
  const byId = new Map(scripts.map((s) => [s.id, s]));
  const resolved: { item: R; script: T }[] = [];
  for (const item of items) {
    const script = byId.get(item.scriptId);
    if (script) {
      resolved.push({ item, script });
    }
  }
  return resolved;
}

/** Total scripts a set of curated groups (one per card) will render. */
export function countCuratedScripts<T extends HasScriptId>(
  scripts: readonly T[],
  groups: readonly (readonly string[])[]
): number {
  const known = new Set(scripts.map((s) => s.id));
  let total = 0;
  for (const group of groups) {
    for (const id of group) {
      if (known.has(id)) {
        total += 1;
      }
    }
  }
  return total;
}
