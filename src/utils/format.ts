export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `~${mins} min`;
  return `~${mins} min ${secs}s`;
}

export function formatMemoryTotal(total: string): string {
  const match = total.match(/^([\d.,]+)\s*(\w+)/);
  if (!match) return total;
  const value = parseFloat(match[1].replace(',', '.'));
  if (Number.isNaN(value)) return total;
  return `${Math.round(value)} ${match[2]}`;
}
