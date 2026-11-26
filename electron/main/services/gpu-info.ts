import { parsePowerShellJson } from '../utils/powershell-json';

export interface GpuController {
  name: string;
  driverVersion: string;
  pnpDeviceId: string;
}

const DEDICATED_PATTERNS = [
  /geforce/i,
  /radeon rx/i,
  /radeon vii/i,
  /radeon pro/i,
  /quadro/i,
  /tesla/i,
  /\barc\b/i,
  /nvidia rtx/i,
];

const IGPU_PATTERNS = [
  /intel.*(uhd|hd|iris)/i,
  /radeon\(tm\) graphics/i,
  /radeon\(tm\)\s*\d{2,3}[mu]/i,
  /microsoft basic display/i,
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseVideoControllers(json: string): GpuController[] {
  const parsed = parsePowerShellJson(json, {
    label: 'placas de vídeo',
    emptyFallback: [],
    onInvalid: () => [],
  });
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const result: GpuController[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const name = asString(obj.Name);
    if (!name) continue;
    result.push({
      name,
      driverVersion: asString(obj.DriverVersion),
      pnpDeviceId: asString(obj.PNPDeviceID),
    });
  }
  return result;
}

export function pickDedicatedGpu(controllers: GpuController[]): GpuController | null {
  if (controllers.length === 0) return null;
  const dedicated = controllers.find((c) => DEDICATED_PATTERNS.some((p) => p.test(c.name)));
  if (dedicated) return dedicated;
  const notIgpu = controllers.find((c) => !IGPU_PATTERNS.some((p) => p.test(c.name)));
  return notIgpu ?? controllers[0] ?? null;
}

export function matchRegistryVram(entries: string[], pnpDeviceId: string): number | null {
  if (!pnpDeviceId) return null;
  const target = pnpDeviceId.toLowerCase();
  for (const entry of entries) {
    const sep = entry.lastIndexOf('|');
    if (sep <= 0) continue;
    const deviceId = entry.slice(0, sep).toLowerCase();
    const value = Number(entry.slice(sep + 1));
    if (!Number.isFinite(value) || value <= 0) continue;
    if (target.startsWith(deviceId)) return value;
  }
  return null;
}

export function formatVramGb(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 3)} GB`;
}
