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

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('pt-BR');
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatUptimeCompact(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatUptimeLong(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [
    days > 0 && `${days} d`,
    hours > 0 && `${hours} h`,
    minutes > 0 && `${minutes} min`,
    remainingSeconds > 0 && `${remainingSeconds} s`,
  ].filter(Boolean);
  return parts.join(' ') || '0 s';
}

export function formatElapsedMs(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
