import type { ExecutionHistoryEntry } from '../shared/ipc-types';

/**
 * Maps retired AMD/Intel catalog ids to the neutral `cpu-N` script that
 * replaced them. The split existed only as folder organisation: the merged
 * pairs were byte-identical or differed solely in banner/credit lines, so no
 * id had to survive on its own merits. Aliases for scripts later retired from
 * the catalog are dropped — pointing history at a script that no longer ships
 * would only invent an "applied" tweak the user never ran.
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
  'amd-16': 'cpu-16',
  'intel-24': 'cpu-16',
  'amd-18': 'cpu-18',
  'intel-22': 'cpu-18',
  'amd-20': 'cpu-20',
  'intel-20': 'cpu-20',
  'amd-21': 'cpu-21',
  'intel-19': 'cpu-21',
  'amd-24': 'cpu-21',
  'intel-16': 'cpu-21',
  'amd-29': 'cpu-21',
  'intel-25': 'cpu-21',
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
  // Ids aposentados na dedup da beta. Não removidos do mapa: histórico e
  // preferências antigas continuam resolvendo para o sobrevivente.
  'cpu-24': 'cpu-21',
  'cpu-29': 'cpu-21',
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
