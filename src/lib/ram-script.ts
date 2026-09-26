/**
 * Picks the RAM script matching the installed capacity. The ladder is a single
 * `cpu-30`..`cpu-36` sequence now that the vendor duplicates are gone, so the
 * tier no longer depends on which CPU was detected.
 */
export function getRamScriptId(ramGb: number): string {
  if (ramGb <= 4) return 'cpu-30';
  if (ramGb <= 6) return 'cpu-31';
  if (ramGb <= 8) return 'cpu-32';
  if (ramGb <= 12) return 'cpu-33';
  if (ramGb <= 16) return 'cpu-34';
  if (ramGb <= 32) return 'cpu-35';
  return 'cpu-36';
}
