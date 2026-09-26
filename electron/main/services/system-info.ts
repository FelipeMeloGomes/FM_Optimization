import { arch, cpus, freemem, release, totalmem, type, uptime, version } from 'node:os';
import type {
  CpuInfo,
  DashboardData,
  GpuInfo,
  MemoryInfo,
  OsInfo,
  StorageDrive,
} from '../../shared/ipc-types';
import { getCpuIdentityOnce, normalizeCpuVendor } from './cpu-vendor';
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

export async function getCpuInfo(): Promise<CpuInfo> {
  const cpu = cpus()[0];
  const model = cpu?.model || 'Unknown';
  const fallbackCores = cpus().length;

  const [identity, cpuDetail, usageOutput] = await Promise.all([
    getCpuIdentityOnce(),
    execPowerShell(
      'Get-CimInstance Win32_Processor | Select-Object -First 1 NumberOfCores,NumberOfLogicalProcessors | ConvertTo-Json'
    ).catch(() => ''),
    execPowerShell(
      '$cpu = Get-Counter "\\Processor(_Total)\\% Processor Time"; [math]::Round($cpu.CounterSamples.CookedValue)'
    ).catch(() => ''),
  ]);

  let cores = fallbackCores;
  let logicalProcessors = fallbackCores;

  if (cpuDetail) {
    try {
      const parsed = JSON.parse(cpuDetail);
      if (parsed.NumberOfCores) cores = parsed.NumberOfCores;
      if (parsed.NumberOfLogicalProcessors) logicalProcessors = parsed.NumberOfLogicalProcessors;
    } catch {
      /* fallback */
    }
  }

  const usage = usageOutput ? parseInt(usageOutput.trim(), 10) || 0 : 0;

  return {
    model,
    manufacturer: identity.manufacturer ?? '',
    vendor: normalizeCpuVendor(identity),
    cores,
    logicalProcessors,
    architecture: arch(),
    usage,
  };
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
  const name = gpu?.name ?? 'N/A';
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

  return { name, vram, driverVersion, usage };
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
