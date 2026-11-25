import { arch, cpus, freemem, release, totalmem, type, uptime, version } from 'node:os';
import type {
  CacheInfo,
  CpuInfo,
  DashboardData,
  GpuInfo,
  MemoryInfo,
  MotherboardInfo,
  OsInfo,
  StorageDrive,
} from '../../shared/ipc-types';
import { resolveCpuName } from './cpu-identity';
import { type CpuIdentity, getCpuIdentityOnce, normalizeCpuVendor } from './cpu-vendor';
import { formatGpuName } from './gpu-identity';
import { formatVramGb, matchRegistryVram, pickDedicatedGpu } from './gpu-info';
import { execPowerShell } from './powershell';

// Cache for consolidated WMI queries
let wmiCache: { data: ConsolidatedWmiData; expires: number } | null = null;
let wmiCacheTtl = 5000; // 5 seconds default

export function setPowerSaveMode(enabled: boolean): void {
  wmiCacheTtl = enabled ? 300000 : 5000; // 5 minutes when power save, 5 seconds otherwise
}

interface ConsolidatedWmiData {
  cpu?: WmiProcessor;
  gpu?: { name: string; driverVersion: string; pnpDeviceId: string }[];
  memory?: { type: string; slots: number; frequency: string }[];
  os?: { caption: string; buildNumber: string; version: string; installDate: string };
  drives?: {
    deviceId: string;
    volumeName: string;
    size: number;
    free: number;
    fileSystem: string;
  }[];
  physicalDisk?: { mediaType: string }[];
  diskMap?: string;
  motherboard?: { Manufacturer: string; Product: string; Version: string };
  bios?: string;
  caches?: { Level: number; MaxCacheSize: number }[];
  memorySlots?: string;
  memoryUsed?: string;
}

const WMI_CONSOLIDATED_QUERY = `
$ProgressPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor -Property Name,Manufacturer,Description,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | Select-Object -First 1 | ConvertTo-Json
$cache = Get-CimInstance Win32_CacheMemory -ErrorAction SilentlyContinue | Select-Object Level,MaxCacheSize | ConvertTo-Json -Depth 3
$gpu = Get-CimInstance Win32_VideoController -Property Name,DriverVersion,PNPDeviceID | ConvertTo-Json -Depth 3
$mem = Get-CimInstance Win32_PhysicalMemory -Property SMBIOSMemoryType,Speed | ConvertTo-Json -Depth 3
$board = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1 | Select-Object Manufacturer,Product,Version | ConvertTo-Json
$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object @{N="Version";E={$_.SMBIOSBIOSVersion}},@{N="ReleaseDate";E={$_.ReleaseDate.ToString('dd/MM/yyyy')}} | ConvertTo-Json
$slots = (Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue | Measure-Object -Property MemoryDevices -Sum).Sum
$memCount = (Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue | Measure-Object).Count
$os = Get-CimInstance Win32_OperatingSystem -Property Caption,Version,BuildNumber,InstallDate | ConvertTo-Json
$drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -Property DeviceID,VolumeName,Size,FreeSpace,FileSystem | Select-Object DeviceID,VolumeName,@{N="Size";E={$_.Size/1GB}},@{N="Free";E={$_.FreeSpace/1GB}},FileSystem | ConvertTo-Json -Depth 3
$physical = Get-PhysicalDisk | Select-Object DeviceId,MediaType,BusType
$disk = $physical | Select-Object MediaType | ConvertTo-Json -Depth 3
$diskMap = Get-Partition -ErrorAction SilentlyContinue | Where-Object DriveLetter | ForEach-Object { $p = $_; $pd = $physical | Where-Object { [int]$_.DeviceId -eq $p.DiskNumber } | Select-Object -First 1; [pscustomobject]@{ DriveLetter = $p.DriveLetter; MediaType = $pd.MediaType; BusType = $pd.BusType } } | ConvertTo-Json -Depth 3
@{ cpu=$cpu; gpu=$gpu; memory=$mem; motherboard=$board; bios=$bios; memorySlots=$slots; memoryUsed=$memCount; caches=$cache; os=$os; drives=$drives; physicalDisk=$disk; diskMap=$diskMap } | ConvertTo-Json -Depth 5
`;

const WMI_CPU_QUERY =
  'Get-CimInstance Win32_Processor -Property Name,Manufacturer,Description,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | Select-Object -First 1 | ConvertTo-Json';

const BIOS_QUERY = `Get-CimInstance Win32_BIOS | Select-Object @{N="Version";E={$_.SMBIOSBIOSVersion}},@{N="ReleaseDate";E={$_.ReleaseDate.ToString('dd/MM/yyyy')}} | ConvertTo-Json`;

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

async function fetchConsolidatedWmi(): Promise<ConsolidatedWmiData> {
  if (wmiCache && Date.now() < wmiCache.expires) {
    return wmiCache.data;
  }

  try {
    const output = await execPowerShell(WMI_CONSOLIDATED_QUERY);
    const parsed = JSON.parse(output) as ConsolidatedWmiData;
    wmiCache = { data: parsed, expires: Date.now() + wmiCacheTtl };
    return parsed;
  } catch {
    return {};
  }
}

function parseConsolidatedGpu(
  raw?: string
): { name: string; driverVersion: string; pnpDeviceId: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .filter(
        (g: unknown): g is { Name: string; DriverVersion: string; PNPDeviceID: string } =>
          typeof g === 'object' && g !== null && 'Name' in g && 'PNPDeviceID' in g
      )
      .map((g) => ({
        name: g.Name,
        driverVersion: g.DriverVersion,
        pnpDeviceId: g.PNPDeviceID,
      }));
  } catch {
    return [];
  }
}

function parseConsolidatedMemory(
  raw?: string
): { type: string; slots: number; frequency: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .filter(
        (m: unknown): m is { SMBIOSMemoryType: string; Speed: number } =>
          typeof m === 'object' && m !== null && 'SMBIOSMemoryType' in m
      )
      .map((m) => ({
        type: m.SMBIOSMemoryType,
        slots: 1,
        frequency: String(m.Speed),
      }));
  } catch {
    return [];
  }
}

function parseConsolidatedOs(
  raw?: string
): { caption: string; buildNumber: string; version: string; installDate: string } | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return {
      caption: parsed.Caption || '',
      buildNumber: parsed.BuildNumber || '',
      version: parsed.Version || '',
      installDate: parsed.InstallDate || '',
    };
  } catch {
    return undefined;
  }
}

function parseConsolidatedDrives(
  raw?: string
): { deviceId: string; volumeName: string; size: number; free: number; fileSystem: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .filter(
        (
          d: unknown
        ): d is {
          DeviceID: string;
          VolumeName: string;
          Size: number;
          Free: number;
          FileSystem: string;
        } => typeof d === 'object' && d !== null && 'DeviceID' in d
      )
      .map((d) => ({
        deviceId: d.DeviceID,
        volumeName: d.VolumeName,
        size: d.Size,
        free: d.Free,
        fileSystem: d.FileSystem,
      }));
  } catch {
    return [];
  }
}

function parseConsolidatedPhysicalDisk(raw?: string): { mediaType: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .filter(
        (d: unknown): d is { MediaType: string } =>
          typeof d === 'object' && d !== null && 'MediaType' in d
      )
      .map((d) => ({ mediaType: d.MediaType }));
  } catch {
    return [];
  }
}

interface DriveMedia {
  mediaType: string;
  busType: string;
}

/** Identidade legível da unidade, usada como selo nos cartões do Dashboard. */
export function formatDriveMediaType(mediaType?: string, busType?: string): string | undefined {
  const media = mediaType?.toLowerCase();
  const bus = busType?.toLowerCase();
  if (media === 'ssd' || bus === 'nvme') return bus === 'nvme' ? 'SSD NVMe' : 'SSD';
  if (media === 'hdd') return 'HD';
  return undefined;
}

function parseDriveMediaMap(raw?: string): Map<string, DriveMedia> {
  const map = new Map<string, DriveMedia>();
  if (!raw) return map;
  try {
    const parsed: unknown = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('DriveLetter' in item) ||
        typeof item.DriveLetter !== 'string'
      ) {
        continue;
      }
      map.set(item.DriveLetter.toUpperCase().replace(':', ''), {
        mediaType: 'MediaType' in item && typeof item.MediaType === 'string' ? item.MediaType : '',
        busType: 'BusType' in item && typeof item.BusType === 'string' ? item.BusType : '',
      });
    }
  } catch {
    // Sem o mapa, o Dashboard mostra apenas o sistema de arquivos.
  }
  return map;
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

  // Try to get WMI data from consolidated cache first
  const wmiData = await fetchConsolidatedWmi();
  // O script consolidado já serializa cada seção com ConvertTo-Json: `cpu`
  // chega como string. Re-serializá-la transformaria o JSON em uma string
  // literal e o parser devolveria um objeto vazio, descartando WMI.
  const cpuDetail =
    typeof wmiData.cpu === 'string' ? wmiData.cpu : wmiData.cpu ? JSON.stringify(wmiData.cpu) : '';

  // If no WMI data, fall back to individual query
  let finalCpuDetail = cpuDetail;
  if (!cpuDetail) {
    finalCpuDetail = await execPowerShell(WMI_CPU_QUERY).catch(() => '');
  }

  const [identity, usageOutput] = await Promise.all([
    getCpuIdentityOnce(),
    execPowerShell(
      '$cpu = Get-Counter "\\Processor(_Total)\\% Processor Time"; [math]::Round($cpu.CounterSamples.CookedValue)'
    ).catch(() => ''),
  ]);

  const usage = usageOutput ? parseInt(usageOutput.trim(), 10) || 0 : 0;

  return buildCpuInfo({
    osModel: cpu?.model,
    logicalCount,
    wmiRaw: finalCpuDetail,
    identity,
    architecture: arch(),
    usage,
  });
}

const REGISTRY_VRAM_CMD =
  "$base='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; 0..9 | ForEach-Object { $p = Get-ItemProperty (Join-Path $base ('000' + $_)) -ErrorAction SilentlyContinue; if ($p.MatchingDeviceId -and $null -ne $p.'HardwareInformation.qwMemorySize') { ($p.MatchingDeviceId + '|' + $p.'HardwareInformation.qwMemorySize') } }";

export async function getGpuInfo(): Promise<GpuInfo> {
  // Try consolidated WMI first
  const wmiData = await fetchConsolidatedWmi();
  let output = wmiData.gpu && Array.isArray(wmiData.gpu) ? JSON.stringify(wmiData.gpu) : '';

  // Fallback to individual query if consolidated failed
  if (!output) {
    output = await execPowerShell(
      'Get-CimInstance Win32_VideoController -Property Name,DriverVersion,PNPDeviceID | ConvertTo-Json -Depth 3'
    ).catch(() => '');
  }

  const [nvidiaVram, registryVramRaw, nvidiaSmi] = await Promise.all([
    execPowerShell(
      'nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null'
    ).catch(() => ''),
    execPowerShell(REGISTRY_VRAM_CMD).catch(() => ''),
    execPowerShell(
      'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null'
    ).catch(() => ''),
  ]);

  const gpuList = parseConsolidatedGpu(output);
  if (gpuList.length === 0) return { name: 'N/A', vram: 'N/A', driverVersion: 'N/A', usage: 0 };

  const gpu = pickDedicatedGpu(
    gpuList.map((g) => ({
      name: g.name,
      driverVersion: g.driverVersion,
      pnpDeviceId: g.pnpDeviceId,
    }))
  );
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
        `(Get-CimInstance Win32_VideoController -Filter "PNPDeviceID='${escapedId}'" -Property AdapterRAM).AdapterRAM`
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

  // Try consolidated WMI first
  const wmiData = await fetchConsolidatedWmi();
  let typeOutput = '';
  let slotsOutput = '';
  let freqOutput = '';

  if (wmiData.memory && Array.isArray(wmiData.memory) && wmiData.memory.length > 0) {
    const mem = wmiData.memory[0];
    // Ensure mem is an object with expected properties
    if (mem && typeof mem === 'object' && 'SMBIOSMemoryType' in mem) {
      typeOutput = String(mem.type ?? '');
      slotsOutput = String(wmiData.memory.length);
      freqOutput = String(mem.frequency ?? '');
    } else {
      // Fall through to individual queries
      typeOutput = '';
      slotsOutput = '';
      freqOutput = '';
    }
  } else {
    // Fallback to individual queries
    [typeOutput, slotsOutput, freqOutput] = await Promise.all([
      execPowerShell(
        '(Get-CimInstance Win32_PhysicalMemory -Property SMBIOSMemoryType | Select-Object -First 1).SMBIOSMemoryType'
      ).catch(() => ''),
      execPowerShell(
        '(Get-CimInstance Win32_PhysicalMemory -Property Speed | Measure-Object).Count'
      ).catch(() => ''),
      execPowerShell(
        '(Get-CimInstance Win32_PhysicalMemory -Property Speed | Select-Object -First 1).Speed'
      ).catch(() => ''),
    ]);
  }

  const typeMap: Record<string, string> = {
    '20': 'DDR',
    '21': 'DDR2',
    '24': 'DDR3',
    '26': 'DDR4',
    '34': 'DDR5',
  };
  const memType = typeMap[typeOutput.trim()] || 'Unknown';
  const moduleCount =
    wmiData.memoryUsed && Number.isFinite(Number(wmiData.memoryUsed))
      ? Number(wmiData.memoryUsed)
      : slotsOutput
        ? parseInt(slotsOutput.trim(), 10)
        : 0;
  const totalSlots =
    wmiData.memorySlots && Number.isFinite(Number(wmiData.memorySlots))
      ? Number(wmiData.memorySlots)
      : moduleCount;
  const freq = freqOutput.trim();

  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    type: memType,
    slots: moduleCount,
    slotsUsed: moduleCount,
    slotsTotal: totalSlots,
    frequency: freq ? `${freq} MHz` : '—',
  };
}

export async function getOsInfo(): Promise<OsInfo> {
  // Try consolidated WMI first
  const wmiData = await fetchConsolidatedWmi();
  let osInfo = wmiData.os;

  // Validate osInfo has expected properties
  if (!osInfo || typeof osInfo !== 'object' || !('Caption' in osInfo)) {
    osInfo = undefined;
  }

  if (!osInfo) {
    // Fallback to individual query
    const output = await execPowerShell(
      'Get-CimInstance Win32_OperatingSystem -Property Caption,Version,BuildNumber,InstallDate | ConvertTo-Json -Depth 3'
    ).catch(() => '');
    osInfo = parseConsolidatedOs(output) || undefined;
  }

  let name = `${type()} ${release()}`;
  let versionFromWmi = release();
  let build = release();
  let edition = version();
  let installDate = '';

  if (osInfo) {
    if (osInfo.caption) {
      name = osInfo.caption;
      // "Microsoft Windows 11 Pro" → "Pro": o campo `version` já traz
      // "10.0.26100", então repeti-lo como edição não informa nada.
      const fromCaption = osInfo.caption
        .replace(/^(?:Microsoft\s+)?Windows\s*/i, '')
        .replace(/^\d+(?:\.\d+)?\s*/, '')
        .trim();
      if (fromCaption) edition = fromCaption;
    }
    if (osInfo.buildNumber) build = osInfo.buildNumber;
    if (osInfo.version) versionFromWmi = osInfo.version;
    if (osInfo.installDate) installDate = osInfo.installDate;
  }

  return { name, version: versionFromWmi, build, edition, installDate };
}

interface RawDriveInfo {
  DeviceID?: string;
  VolumeName?: string;
  Size?: number;
  Free?: number;
  FileSystem?: string;
}

export async function getStorageDrives(): Promise<StorageDrive[]> {
  // Try consolidated WMI first
  const wmiData = await fetchConsolidatedWmi();
  let drives = wmiData.drives;

  if (!drives || !Array.isArray(drives) || drives.length === 0) {
    // Fallback to individual query
    const output = await execPowerShell(
      'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -Property DeviceID,VolumeName,Size,FreeSpace,FileSystem | Select-Object DeviceID,VolumeName,@{N="Size";E={$_.Size/1GB}},@{N="Free";E={$_.FreeSpace/1GB}},FileSystem | ConvertTo-Json -Depth 3'
    ).catch(() => '');
    drives = parseConsolidatedDrives(output);
  }

  const mediaByLetter = parseDriveMediaMap(wmiData.diskMap);

  return drives.map((d) => {
    const size = d.size || 0;
    const free = d.free || 0;
    const usedPercent = size > 0 ? Math.round(((size - free) / size) * 100) : 0;
    const fileSystem = d.fileSystem || '';
    const media = mediaByLetter.get((d.deviceId || '').toUpperCase().replace(':', ''));
    const identity = media && formatDriveMediaType(media.mediaType, media.busType);

    return {
      letter: d.deviceId || '',
      label: d.volumeName || '',
      size: d.size ? `${Math.round(d.size)} GB` : 'N/A',
      free: d.free ? `${Math.round(d.free)} GB` : 'N/A',
      usedPercent,
      type: identity || fileSystem,
      fileSystem,
    };
  });
}

export async function hasSolidStateDrive(): Promise<boolean> {
  // Try consolidated WMI first
  const wmiData = await fetchConsolidatedWmi();
  const physicalDisks = wmiData.physicalDisk;

  if (!physicalDisks || !Array.isArray(physicalDisks) || physicalDisks.length === 0) {
    // Fallback to individual query
    const output = await execPowerShell(
      '(Get-PhysicalDisk | Where-Object MediaType -eq "SSD" | Measure-Object).Count'
    ).catch(() => '');
    const count = Number.parseInt(output.trim(), 10);
    return Number.isFinite(count) && count > 0;
  }

  return physicalDisks.some((d) => d.mediaType === 'SSD');
}

function parseJsonArray(raw?: string | unknown[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function formatCacheSize(kb?: number): string | undefined {
  if (!kb || kb <= 0) return undefined;
  return kb >= 1024 ? `${Math.round((kb / 1024) * 100) / 100} MB` : `${kb} KB`;
}

function parseBios(raw?: string): { version: string; releaseDate: string } | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { Version?: string; ReleaseDate?: string };
    return { version: parsed.Version || '', releaseDate: parsed.ReleaseDate || '' };
  } catch {
    return undefined;
  }
}

async function fetchBiosInfo(): Promise<{ version: string; releaseDate: string } | undefined> {
  const output = await execPowerShell(BIOS_QUERY).catch(() => '');
  return parseBios(output);
}

export async function getMotherboardInfo(): Promise<MotherboardInfo> {
  const wmi = await fetchConsolidatedWmi();
  const bios = parseBios(wmi.bios) ?? (await fetchBiosInfo());
  const board = wmi.motherboard;
  if (board && typeof board === 'object' && 'Manufacturer' in board) {
    return {
      manufacturer: board.Manufacturer || '—',
      product: board.Product || '—',
      version: (board.Version || '').trim() || '—',
      biosVersion: bios?.version || '',
      biosReleaseDate: bios?.releaseDate || '',
    };
  }

  const output = await execPowerShell(
    'Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version | ConvertTo-Json -Depth 2'
  ).catch(() => '');
  try {
    const parsed = JSON.parse(output) as {
      Manufacturer?: string;
      Product?: string;
      Version?: string;
    };
    return {
      manufacturer: parsed.Manufacturer || '—',
      product: parsed.Product || '—',
      version: (parsed.Version || '').trim() || '—',
      biosVersion: bios?.version || '',
      biosReleaseDate: bios?.releaseDate || '',
    };
  } catch {
    return { manufacturer: '—', product: '—', version: '—', biosVersion: '', biosReleaseDate: '' };
  }
}

export async function getCacheInfo(): Promise<CacheInfo> {
  const wmi = await fetchConsolidatedWmi();
  const cached = parseJsonArray(wmi.caches);
  if (cached.length > 0) {
    return cachesFromLevels(cached);
  }

  const output = await execPowerShell(
    'Get-CimInstance Win32_CacheMemory | Select-Object Level,MaxCacheSize | ConvertTo-Json -Depth 3'
  ).catch(() => '');
  try {
    const parsed: unknown = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return cachesFromLevels(items);
  } catch {
    return {};
  }
}

function cachesFromLevels(items: unknown[]): CacheInfo {
  const find = (level: number): string | undefined => {
    for (const item of items) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'Level' in item &&
        Number(item.Level) === level &&
        'MaxCacheSize' in item &&
        typeof item.MaxCacheSize === 'number'
      ) {
        return formatCacheSize(item.MaxCacheSize);
      }
    }
    return undefined;
  };
  // Win32_CacheMemory usa Level 3/4/5 para L1/L2/L3.
  return { l1: find(3), l2: find(4), l3: find(5) };
}

export async function getSystemInfo(): Promise<DashboardData> {
  // Fetch consolidated WMI once for all sub-queries
  await fetchConsolidatedWmi();

  const [cpu, gpu, memory, os, drives, motherboard, caches] = await Promise.all([
    getCpuInfo(),
    getGpuInfo(),
    getMemoryInfo(),
    getOsInfo(),
    getStorageDrives(),
    getMotherboardInfo(),
    getCacheInfo(),
  ]);

  return { cpu, gpu, memory, os, drives, motherboard, caches, uptime: Math.floor(uptime()) };
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}
