import type { ExecutionHistoryEntry } from '../shared/ipc-types';

/**
 * Maps every retired AMD/Intel catalog id to the neutral `cpu-N` script that
 * replaced it. The 74-entry split existed only as folder organisation: the
 * merged pairs were byte-identical or differed solely in banner/credit lines,
 * so no id had to survive on its own merits.
 *
 * Every lookup path must resolve through {@link resolveScriptId} *before*
 * comparing against the catalog, not after. There are three such guards, and
 * all of them reject unknown ids independently of the registry:
 * `getScriptById` (script-registry), the `elevate-app` handler (ipc-handlers)
 * and the `--elevate-script` entrypoint (index). A shim installed only in the
 * registry would let a legacy id reach `getScriptContent` and then be refused
 * on both elevated paths.
 */
export const LEGACY_SCRIPT_ID_ALIASES: Record<string, string> = {
  'amd-1': 'cpu-1',
  'intel-1': 'cpu-1',
  'amd-2': 'cpu-2',
  'intel-15': 'cpu-2',
  'amd-3': 'cpu-3',
  'intel-14': 'cpu-3',
  'amd-4': 'cpu-4',
  'intel-2': 'cpu-4',
  'amd-5': 'cpu-5',
  'intel-9': 'cpu-5',
  'amd-6': 'cpu-6',
  'intel-10': 'cpu-6',
  'amd-7': 'cpu-7',
  'intel-11': 'cpu-7',
  'amd-8': 'cpu-8',
  'intel-12': 'cpu-8',
  'amd-9': 'cpu-9',
  'intel-13': 'cpu-9',
  'amd-10': 'cpu-10',
  'intel-3': 'cpu-10',
  'amd-11': 'cpu-11',
  'intel-4': 'cpu-11',
  'amd-12': 'cpu-12',
  'intel-5': 'cpu-12',
  'amd-13': 'cpu-13',
  'intel-7': 'cpu-13',
  'amd-14': 'cpu-14',
  'intel-6': 'cpu-14',
  'amd-15': 'cpu-15',
  'intel-8': 'cpu-15',
  'amd-16': 'cpu-16',
  'intel-24': 'cpu-16',
  'amd-17': 'cpu-17',
  'intel-23': 'cpu-17',
  'amd-18': 'cpu-18',
  'intel-22': 'cpu-18',
  'amd-19': 'cpu-19',
  'intel-21': 'cpu-19',
  'amd-20': 'cpu-20',
  'intel-20': 'cpu-20',
  'amd-21': 'cpu-21',
  'intel-19': 'cpu-21',
  'amd-22': 'cpu-22',
  'intel-18': 'cpu-22',
  'amd-23': 'cpu-23',
  'intel-17': 'cpu-23',
  'amd-24': 'cpu-24',
  'intel-16': 'cpu-24',
  'amd-25': 'cpu-25',
  'intel-29': 'cpu-25',
  'amd-26': 'cpu-26',
  'intel-28': 'cpu-26',
  'amd-27': 'cpu-27',
  'intel-27': 'cpu-27',
  'amd-28': 'cpu-28',
  'intel-26': 'cpu-28',
  'amd-29': 'cpu-29',
  'intel-25': 'cpu-29',
  'amd-30': 'cpu-30',
  'intel-30': 'cpu-30',
  'amd-31': 'cpu-31',
  'intel-31': 'cpu-31',
  'amd-32': 'cpu-32',
  'intel-32': 'cpu-32',
  'amd-33': 'cpu-33',
  'intel-33': 'cpu-33',
  'amd-34': 'cpu-34',
  'intel-34': 'cpu-34',
  'amd-35': 'cpu-35',
  'intel-35': 'cpu-35',
  'amd-36': 'cpu-36',
  'intel-36': 'cpu-36',
  'amd-37': 'cpu-37',
  'intel-37': 'cpu-37',
};

/** Identity for current and unknown ids; only retired ids are rewritten. */
export function resolveScriptId(id: string): string {
  return LEGACY_SCRIPT_ID_ALIASES[id] ?? id;
}

/**
 * One-shot migration of persisted execution history: rewrites every legacy
 * `scriptId` to its current target, in place, and reports whether anything
 * moved. Called from `loadUserData` on every launch, so a user only has to
 * open the app once for their history to be normalised.
 *
 * Kept pure and fs-free so it is testable without stubbing electron paths.
 * The audit log is append-only and never rewritten, but nothing looks ids up
 * there, so it needs no migration.
 *
 * @returns true when at least one entry was rewritten.
 */
export function rewriteHistoryScriptIds(entries: ExecutionHistoryEntry[]): boolean {
  let changed = false;
  for (const entry of entries) {
    const resolved = resolveScriptId(entry.scriptId);
    if (resolved !== entry.scriptId) {
      entry.scriptId = resolved;
      changed = true;
    }
  }
  return changed;
}
