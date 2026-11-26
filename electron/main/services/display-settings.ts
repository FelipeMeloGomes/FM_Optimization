import {
  DISPLAY_MAX_FREQUENCY,
  DISPLAY_MIN_FREQUENCY,
  DISPLAY_MIN_HEIGHT,
  DISPLAY_MIN_WIDTH,
  type DisplayMode,
  type DisplayMonitor,
  type DisplaySettings,
} from '../../shared/display-settings';
import { isIntegerInRange } from '../utils/numeric';
import { parsePowerShellJson } from '../utils/powershell-json';
import { execPowerShell } from './powershell';

type Executor = (script: string, timeout?: number) => Promise<string>;

/** DISPLAY_DEVICE e DEVMODE completos para EnumDisplayDevices/EnumDisplaySettingsEx. */
const NATIVE_TYPE = `$nativeSource = @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
public struct FmDisplayDevice {
  [MarshalAs(UnmanagedType.U4)] public int cb;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
  [MarshalAs(UnmanagedType.U4)] public int StateFlags;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
}
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
public struct FmDisplayMode {
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
  public short dmSpecVersion;
  public short dmDriverVersion;
  public short dmSize;
  public short dmDriverExtra;
  public int dmFields;
  public int dmPositionX;
  public int dmPositionY;
  public int dmDisplayOrientation;
  public int dmDisplayFixedOutput;
  public short dmColor;
  public short dmDuplex;
  public short dmYResolution;
  public short dmTTOption;
  public short dmCollate;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
  public short dmLogPixels;
  public int dmBitsPerPel;
  public int dmPelsWidth;
  public int dmPelsHeight;
  public int dmDisplayFlags;
  public int dmDisplayFrequency;
  public int dmICMMethod;
  public int dmICMIntent;
  public int dmMediaType;
  public int dmDitherType;
  public int dmReserved1;
  public int dmReserved2;
  public int dmPanningWidth;
  public int dmPanningHeight;
}
public static class FmOptimizeDisplay {
  [DllImport("user32.dll", CharSet = CharSet.Ansi)]
  public static extern bool EnumDisplayDevices(IntPtr deviceName, int deviceIndex, ref FmDisplayDevice device, int flags);
  [DllImport("user32.dll", CharSet = CharSet.Ansi)]
  public static extern bool EnumDisplaySettingsEx(string deviceName, int modeNum, ref FmDisplayMode mode, int flags);
  [DllImport("user32.dll", CharSet = CharSet.Ansi)]
  public static extern int ChangeDisplaySettingsEx(string deviceName, ref FmDisplayMode mode, IntPtr hwnd, int flags, IntPtr lParam);
}
'@
if (-not ('FmOptimizeDisplay' -as [type])) { Add-Type -TypeDefinition $nativeSource }
$deviceStructSize = [Runtime.InteropServices.Marshal]::SizeOf([type]'FmDisplayDevice')
$modeSize = [Runtime.InteropServices.Marshal]::SizeOf([type]'FmDisplayMode')
`;

const ENUMERATE_MONITORS = `
$monitors = @()
$monitorIndex = 0
for ($deviceIndex = 0; $deviceIndex -lt 16; $deviceIndex++) {
  $device = New-Object FmDisplayDevice
  $device.cb = $deviceStructSize
  if (-not [FmOptimizeDisplay]::EnumDisplayDevices([IntPtr]::Zero, $deviceIndex, [ref]$device, 0)) { continue }
  # DISPLAY_DEVICE_ATTACHED_TO_DESKTOP: ignora portas duplicadas desligadas.
  if (($device.StateFlags -band 0x1) -eq 0) { continue }
  $current = New-Object FmDisplayMode
  $current.dmSize = $modeSize
  if (-not [FmOptimizeDisplay]::EnumDisplaySettingsEx($device.DeviceName, -1, [ref]$current, 0)) { continue }

  $available = @()
  for ($modeIndex = 0; $modeIndex -lt 512; $modeIndex++) {
    $candidate = New-Object FmDisplayMode
    $candidate.dmSize = $modeSize
    if (-not [FmOptimizeDisplay]::EnumDisplaySettingsEx($device.DeviceName, $modeIndex, [ref]$candidate, 0)) { break }
    if ($candidate.dmPelsWidth -lt ${DISPLAY_MIN_WIDTH} -or $candidate.dmPelsHeight -lt ${DISPLAY_MIN_HEIGHT} -or $candidate.dmDisplayFrequency -lt ${DISPLAY_MIN_FREQUENCY}) { continue }
    $available += [pscustomobject]@{
      width = $candidate.dmPelsWidth
      height = $candidate.dmPelsHeight
      frequency = $candidate.dmDisplayFrequency
    }
  }

  $monitorIndex++
  $monitors += [pscustomobject]@{
    deviceName = $device.DeviceName
    label = "Monitor $monitorIndex"
    isPrimary = (($device.StateFlags -band 0x4) -ne 0)
    width = $current.dmPelsWidth
    height = $current.dmPelsHeight
    frequency = $current.dmDisplayFrequency
    modes = @($available | Sort-Object width, height, frequency -Unique)
  }
}
if ($monitors.Count -eq 0) { throw 'Nenhum monitor ativo encontrado' }
@{ monitors = @($monitors) } | ConvertTo-Json -Depth 6 -Compress
`;

function validDimension(value: unknown, min: number): value is number {
  return isIntegerInRange(value, min, 16384);
}

function validFrequency(value: unknown): value is number {
  return isIntegerInRange(value, DISPLAY_MIN_FREQUENCY, DISPLAY_MAX_FREQUENCY);
}

/** Aceita apenas nomes no formato \\.\DISPLAYn, para não interpolhar texto na query. */
export function validDeviceName(value: unknown): value is string {
  return typeof value === 'string' && /^\\\\\.\\DISPLAY\d{1,2}$/.test(value);
}

function parseMode(value: unknown): DisplayMode {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Modo de vídeo inválido');
  }
  const candidate = value as Record<string, unknown>;
  if (
    !validDimension(candidate.width, DISPLAY_MIN_WIDTH) ||
    !validDimension(candidate.height, DISPLAY_MIN_HEIGHT) ||
    !validFrequency(candidate.frequency)
  ) {
    throw new Error('Resolução ou taxa de atualização inválida');
  }
  return {
    width: candidate.width,
    height: candidate.height,
    frequency: candidate.frequency,
  };
}

export function parseDisplaySettings(raw: string): DisplaySettings {
  const parsed = parsePowerShellJson(raw, { label: 'configurações do monitor' });

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Configurações do monitor inválidas');
  }
  const candidate = parsed as Record<string, unknown>;
  const rawMonitors = candidate.monitors;
  if (!Array.isArray(rawMonitors) || rawMonitors.length === 0) {
    throw new Error('Nenhum monitor ativo encontrado');
  }

  const monitors: DisplayMonitor[] = rawMonitors.map((value, index) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Monitor inválido');
    }
    const monitor = value as Record<string, unknown>;
    if (!validDeviceName(monitor.deviceName)) {
      throw new Error('Monitor não identificado');
    }
    if (
      !validDimension(monitor.width, DISPLAY_MIN_WIDTH) ||
      !validDimension(monitor.height, DISPLAY_MIN_HEIGHT)
    ) {
      throw new Error('Resolução inválida');
    }
    if (!validFrequency(monitor.frequency)) {
      throw new Error('Taxa de atualização inválida');
    }
    if (!Array.isArray(monitor.modes)) {
      throw new Error('Lista de modos de vídeo inválida');
    }
    return {
      deviceName: monitor.deviceName,
      label: typeof monitor.label === 'string' ? monitor.label : `Monitor ${index + 1}`,
      isPrimary: monitor.isPrimary === true,
      width: monitor.width,
      height: monitor.height,
      frequency: monitor.frequency,
      modes: monitor.modes.map(parseMode),
    };
  });

  return { monitors };
}

export function buildReadDisplaySettingsScript(): string {
  return `${NATIVE_TYPE}${ENUMERATE_MONITORS}`;
}

export function buildApplyDisplaySettingsScript(deviceName: string, mode: DisplayMode): string {
  if (!validDeviceName(deviceName)) {
    throw new Error('Monitor inválido');
  }
  const parsed = parseMode(mode);
  return `${NATIVE_TYPE}
$targetDevice = '${deviceName}'
$targetMode = New-Object FmDisplayMode
$targetMode.dmSize = $modeSize
if (-not [FmOptimizeDisplay]::EnumDisplaySettingsEx($targetDevice, -1, [ref]$targetMode, 0)) {
  throw "Não foi possível ler o modo atual de $targetDevice"
}
$targetMode.dmPelsWidth = ${parsed.width}
$targetMode.dmPelsHeight = ${parsed.height}
$targetMode.dmDisplayFrequency = ${parsed.frequency}
$targetMode.dmFields = 0x80000 -bor 0x100000 -bor 0x400000
# CDS_UPDATEREGISTRY | CDS_RESET: aplica e salva sem exigir logoff.
$changeResult = [FmOptimizeDisplay]::ChangeDisplaySettingsEx($targetDevice, [ref]$targetMode, [IntPtr]::Zero, 0x40000001, [IntPtr]::Zero)
if ($changeResult -ne 0) {
  throw "O Windows recusou o modo ${parsed.width}x${parsed.height}@${parsed.frequency} Hz em $targetDevice (código $changeResult)"
}
${ENUMERATE_MONITORS}`;
}

export async function readDisplaySettings(
  exec: Executor = execPowerShell
): Promise<DisplaySettings> {
  return parseDisplaySettings(await exec(buildReadDisplaySettingsScript()));
}

export async function applyDisplaySettings(
  deviceName: string,
  mode: DisplayMode,
  exec: Executor = execPowerShell
): Promise<DisplaySettings> {
  if (!validDeviceName(deviceName)) {
    throw new Error('Monitor inválido');
  }
  parseMode(mode);
  return parseDisplaySettings(await exec(buildApplyDisplaySettingsScript(deviceName, mode)));
}
