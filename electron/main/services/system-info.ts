import { arch, cpus, freemem, release, totalmem, type, uptime, version } from 'node:os';
import type {
  CpuInfo,
  DashboardData,
  GpuInfo,
  MemoryInfo,
  OsInfo,
  StorageDrive,
} from '../../shared/ipc-types';
import { resolveCpuName } from './cpu-identity';
import { type CpuIdentity, getCpuIdentityOnce, normalizeCpuVendor } from './cpu-vendor';
import { formatGpuName } from './gpu-identity';
import {
  formatVramGb,
  matchRegistryVram,
  parseVideoControllers,
  pickDedicatedGpu,
} from './gpu-info';
import { execPowerShell } from './powershell';

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

const WMI_CPU_QUERY =
  'Get-CimInstance Win32_Processor | Select-Object -First 1 Name, Manufacturer, Description, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | ConvertTo-Json';

interface WmiProcessor {
  name?: string;
  manufacturer?: string;
  description?: string;
  numberOfCores?: number;
  numberOfLogicalProcessors?: number;
  maxClockSpeed?: number;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseWmiProcessor(raw?: string): WmiProcessor {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!item || typeof item !== 'object') return {};

    const record = item as Record<string, unknown>;
    return {
      name: typeof record.Name === 'string' ? record.Name : undefined,
      manufacturer: typeof record.Manufacturer === 'string' ? record.Manufacturer : undefined,
      description: typeof record.Description === 'string' ? record.Description : undefined,
      numberOfCores: asFiniteNumber(record.NumberOfCores),
      numberOfLogicalProcessors: asFiniteNumber(record.NumberOfLogicalProcessors),
      maxClockSpeed: asFiniteNumber(record.MaxClockSpeed),
    };
  } catch {
    return {};
  }
}

export interface CpuInfoSources {
  osModel?: string;
  logicalCount: number;
  wmiRaw?: string;
  identity?: CpuIdentity;
  architecture: string;
  usage: number;
}

/**
 * Monta o `CpuInfo` a partir das três fontes possíveis. O WMI é a fonte
 * primária; `os.cpus()` e o `systeminformation` cobrem falhas do WMI.
 *
 * O modelo nunca é usado como fallback do fabricante sem passar por aqui: era
 * esse caminho que deixava um Ryzen com `vendor: unknown` quando o WMI falhava.
 */
export function buildCpuInfo(sources: CpuInfoSources): CpuInfo {
  const wmi = parseWmiProcessor(sources.wmiRaw);
  const identity = sources.identity ?? {};

  const vendor = normalizeCpuVendor({
    manufacturer: wmi.manufacturer ?? identity.manufacturer,
    vendor: identity.vendor,
    model: wmi.name ?? sources.osModel ?? identity.brand,
  });

  // O `si.cpu().brand` vem sem o fabricante ("Ryzen 7 5700X 8-Core Processor"),
  // então prefixamos para manter o padrão "AMD Ryzen 7 5700X".
  const siBrand = identity.brand
    ? [identity.manufacturer, identity.brand].filter(Boolean).join(' ')
    : undefined;

  const resolved = resolveCpuName({
    wmiName: wmi.name,
    osModel: sources.osModel,
    siBrand,
    description: wmi.description,
    vendor,
  });

  const logicalProcessors = wmi.numberOfLogicalProcessors ?? sources.logicalCount;
  const coresFromWmi = wmi.numberOfCores;
  const coresFromSi = identity.physicalCores;
  const cores = coresFromWmi ?? coresFromSi ?? logicalProcessors;

  return {
    model: resolved.name,
    rawModel: resolved.raw || undefined,
    manufacturer: wmi.manufacturer ?? identity.manufacturer ?? '',
    vendor,
    cores,
    logicalProcessors,
    architecture: sources.architecture,
    usage: sources.usage,
    family: resolved.family,
    modelNumber: resolved.modelNumber,
    stepping: resolved.stepping,
    maxClockMhz: wmi.maxClockSpeed,
    nameSource: resolved.source,
    nameIsGeneric: resolved.generic,
    coresEstimated: coresFromWmi == null && coresFromSi == null,
  };
}

export async function getCpuInfo(): Promise<CpuInfo> {
  const cpu = cpus()[0];
  const logicalCount = cpus().length;

  const [identity, cpuDetail, usageOutput] = await Promise.all([
    getCpuIdentityOnce(),
    execPowerShell(WMI_CPU_QUERY).catch(() => ''),
    execPowerShell(
      '$cpu = Get-Counter "\\Processor(_Total)\\% Processor Time"; [math]::Round($cpu.CounterSamples.CookedValue)'
    ).catch(() => ''),
  ]);

  const usage = usageOutput ? parseInt(usageOutput.trim(), 10) || 0 : 0;

  return buildCpuInfo({
    osModel: cpu?.model,
    logicalCount,
    wmiRaw: cpuDetail,
    identity,
    architecture: arch(),
    usage,
  });
}

const REGISTRY_VRAM_CMD =
  "$base='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; 0..9 | ForEach-Object { $p = Get-ItemProperty (Join-Path $base ('000' + $_)) -ErrorAction SilentlyContinue; if ($p.MatchingDeviceId -and $null -ne $p.'HardwareInformation.qwMemorySize') { ($p.MatchingDeviceId + '|' + $p.'HardwareInformation.qwMemorySize') } }";

export async function getGpuInfo(): Promise<GpuInfo> {
  const [output, nvidiaVram, registryVramRaw, nvidiaSmi] = await Promise.all([
    execPowerShell(
      'Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,PNPDeviceID | ConvertTo-Json -Depth 3'
    ).catch(() => ''),
    execPowerShell(
      'nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null'
    ).catch(() => ''),
    execPowerShell(REGISTRY_VRAM_CMD).catch(() => ''),
    execPowerShell(
      'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null'
    ).catch(() => ''),
  ]);

  if (!output) return { name: 'N/A', vram: 'N/A', driverVersion: 'N/A', usage: 0 };

  const gpu = pickDedicatedGpu(parseVideoControllers(output));
  const name = formatGpuName(gpu?.name);
  const driverVersion = gpu?.driverVersion || 'N/A';

  let vram = 'N/A';
  if (nvidiaVram) {
    const val = parseInt(nvidiaVram.trim(), 10);
    if (!Number.isNaN(val) && val > 0) vram = `${Math.round(val / 1024)} GB`;
  } else if (gpu) {
    const regBytes = matchRegistryVram(registryVramRaw.split(/\r?\n/), gpu.pnpDeviceId);
    if (regBytes) {
      vram = formatVramGb(regBytes);
    } else {
      const escapedId = gpu.pnpDeviceId.replace(/'/g, "''");
      const adapterRam = await execPowerShell(
        `(Get-CimInstance Win32_VideoController -Filter "PNPDeviceID='${escapedId}'").AdapterRAM`
      ).catch(() => '');
      if (adapterRam) {
        const val = parseInt(adapterRam.trim(), 10);
        if (!Number.isNaN(val) && val > 0) vram = formatVramGb(val);
      }
    }
  }

  let usage = 0;
  if (nvidiaSmi) {
    const val = parseInt(nvidiaSmi.trim(), 10);
    if (!Number.isNaN(val)) usage = val;
  } else {
    const gpuUsage = await execPowerShell(
      "$counters = (Get-Counter '\\GPU Engine(*)\\Utilization Percentage').CounterSamples | Where-Object { $_.CookedValue -gt 0 }; $max = ($counters | Measure-Object -Property CookedValue -Maximum).Maximum; [math]::Round($max)"
    ).catch(() => '');
    if (gpuUsage) {
      const val = parseInt(gpuUsage.trim(), 10);
      if (!Number.isNaN(val)) usage = val;
    }
  }

  return { name, rawName: gpu?.name, vram, driverVersion, usage };
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  const total = totalmem();
  const free = freemem();
  const used = total - free;

  const [typeOutput, slotsOutput, freqOutput] = await Promise.all([
    execPowerShell(
      '(Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1).SMBIOSMemoryType'
    ).catch(() => ''),
    execPowerShell('(Get-CimInstance Win32_PhysicalMemory | Measure-Object).Count').catch(() => ''),
    execPowerShell('(Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1).Speed').catch(
      () => ''
    ),
  ]);

  const typeMap: Record<string, string> = {
    '20': 'DDR',
    '21': 'DDR2',
    '24': 'DDR3',
    '26': 'DDR4',
    '34': 'DDR5',
  };
  const memType = typeMap[typeOutput.trim()] || 'Unknown';
  const slots = slotsOutput ? parseInt(slotsOutput.trim(), 10) : 0;
  const freq = freqOutput.trim();

  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    type: memType,
    slots,
    frequency: freq ? `${freq} MHz` : '—',
  };
}

export async function getOsInfo(): Promise<OsInfo> {
  const output = await execPowerShell(
    'Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,InstallDate | ConvertTo-Json -Depth 3'
  ).catch(() => '');

  let name = `${type()} ${release()}`;
  let build = release();
  let edition = version();
  let installDate = '';

  if (output) {
    try {
      const parsed = JSON.parse(output);
      if (parsed.Caption) name = parsed.Caption;
      if (parsed.BuildNumber) build = parsed.BuildNumber;
      if (parsed.Version) edition = parsed.Version;
      if (parsed.InstallDate) installDate = parsed.InstallDate;
    } catch {
      /* use defaults */
    }
  }

  return { name, version: release(), build, edition, installDate };
}

interface RawDriveInfo {
  DeviceID?: string;
  VolumeName?: string;
  Size?: number;
  Free?: number;
  FileSystem?: string;
}

export async function getStorageDrives(): Promise<StorageDrive[]> {
  const output = await execPowerShell(
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName,@{N="Size";E={$_.Size/1GB}},@{N="Free";E={$_.FreeSpace/1GB}},FileSystem | ConvertTo-Json -Depth 3'
  ).catch(() => '');
  if (!output) return [];

  try {
    const parsed = JSON.parse(output);
    const items: RawDriveInfo[] = Array.isArray(parsed) ? parsed : [parsed];
    return items.map((d) => {
      const size = d.Size || 0;
      const free = d.Free || 0;
      const usedPercent = size > 0 ? Math.round(((size - free) / size) * 100) : 0;
      return {
        letter: d.DeviceID || '',
        label: d.VolumeName || '',
        size: d.Size ? `${Math.round(d.Size)} GB` : 'N/A',
        free: d.Free ? `${Math.round(d.Free)} GB` : 'N/A',
        usedPercent,
        type: d.FileSystem || '',
      };
    });
  } catch {
    return [];
  }
}

export async function hasSolidStateDrive(): Promise<boolean> {
  const output = await execPowerShell(
    '(Get-PhysicalDisk | Where-Object MediaType -eq "SSD" | Measure-Object).Count'
  ).catch(() => '');
  const count = Number.parseInt(output.trim(), 10);
  return Number.isFinite(count) && count > 0;
}

export async function getSystemInfo(): Promise<DashboardData> {
  const [cpu, gpu, memory, os, drives] = await Promise.all([
    getCpuInfo(),
    getGpuInfo(),
    getMemoryInfo(),
    getOsInfo(),
    getStorageDrives(),
  ]);

  return { cpu, gpu, memory, os, drives, uptime: Math.floor(uptime()) };
}
