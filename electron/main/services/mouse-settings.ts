import {
  MOUSE_DOUBLE_CLICK_MAX,
  MOUSE_DOUBLE_CLICK_MIN,
  MOUSE_POINTER_SPEED_MAX,
  MOUSE_POINTER_SPEED_MIN,
  type MouseSettings,
} from '../../shared/mouse-settings';
import { parsePowerShellJson } from '../utils/powershell-json';
import { execPowerShell } from './powershell';

type Executor = (script: string, timeout?: number) => Promise<string>;

const INCLUDE_USER_INI_AND_SEND_CHANGE = 3;

/** P/Invoke usado para ler e gravar as mesmas configurações do painel do Windows. */
const NATIVE_TYPE = `$nativeSource = @'
using System;
using System.Runtime.InteropServices;
public static class FmOptimizeMouseNative {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, int[] pvParam, uint fWinIni);
  [DllImport("user32.dll")]
  public static extern uint GetDoubleClickTime();
}
'@
if (-not ('FmOptimizeMouseNative' -as [type])) { Add-Type -TypeDefinition $nativeSource }
`;

/** Lê os três valores reais e devolve no formato esperado pelo renderer. */
const READ_VALUES = `
$speedPointer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
[void][FmOptimizeMouseNative]::SystemParametersInfo(0x0070, 0, $speedPointer, 0)
$speed = [Runtime.InteropServices.Marshal]::ReadInt32($speedPointer)
[Runtime.InteropServices.Marshal]::FreeHGlobal($speedPointer)

$mouse = [int[]]::new(3)
[void][FmOptimizeMouseNative]::SystemParametersInfo(0x0003, 0, $mouse, 0)

[pscustomobject]@{
  pointerSpeed = $speed
  enhancedPrecision = ($mouse[2] -ne 0)
  doubleClickSpeed = [FmOptimizeMouseNative]::GetDoubleClickTime()
} | ConvertTo-Json -Compress
`;

/** Valida o que veio do Windows (ou do renderer) antes de usar. */
export function validateMouseSettings(value: unknown): MouseSettings {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Configurações do mouse inválidas');
  }

  const candidate = value as Record<string, unknown>;
  const { pointerSpeed, enhancedPrecision, doubleClickSpeed } = candidate;

  if (
    typeof pointerSpeed !== 'number' ||
    !Number.isInteger(pointerSpeed) ||
    !inRange(pointerSpeed, MOUSE_POINTER_SPEED_MIN, MOUSE_POINTER_SPEED_MAX)
  ) {
    throw new Error(
      `Velocidade do ponteiro deve estar entre ${MOUSE_POINTER_SPEED_MIN} e ${MOUSE_POINTER_SPEED_MAX}`
    );
  }
  if (typeof enhancedPrecision !== 'boolean') {
    throw new Error('Precisão do ponteiro deve ser verdadeira ou falsa');
  }
  if (
    typeof doubleClickSpeed !== 'number' ||
    !Number.isInteger(doubleClickSpeed) ||
    !inRange(doubleClickSpeed, MOUSE_DOUBLE_CLICK_MIN, MOUSE_DOUBLE_CLICK_MAX)
  ) {
    throw new Error(
      `Duplo clique deve estar entre ${MOUSE_DOUBLE_CLICK_MIN} e ${MOUSE_DOUBLE_CLICK_MAX} ms`
    );
  }

  return { pointerSpeed, enhancedPrecision, doubleClickSpeed };
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function parseMouseSettings(raw: string): MouseSettings {
  const parsed = parsePowerShellJson(raw, { label: 'configurações do mouse' });
  return validateMouseSettings(parsed);
}

export function buildApplyMouseSettingsScript(settings: MouseSettings): string {
  const validated = validateMouseSettings(settings);
  const thresholds = validated.enhancedPrecision ? '@(6,10,1)' : '@(0,0,0)';

  return `${NATIVE_TYPE}
$flags = ${INCLUDE_USER_INI_AND_SEND_CHANGE}

# SPI_SETMOUSESPEED: o valor vai no ponteiro, com uiParam = 0.
[void][FmOptimizeMouseNative]::SystemParametersInfo(0x0071, 0, [IntPtr]::new(${validated.pointerSpeed}), $flags)

# SPI_SETMOUSE: limiares de aceleração. 0 desliga (movimento 1:1).
$acceleration = [int[]]${thresholds}
[void][FmOptimizeMouseNative]::SystemParametersInfo(0x0004, 0, $acceleration, $flags)

# SPI_SETDOUBLECLICKTIME: o valor vai em uiParam.
[void][FmOptimizeMouseNative]::SystemParametersInfo(0x0020, ${validated.doubleClickSpeed}, [IntPtr]::Zero, $flags)
${READ_VALUES}`;
}

export async function readMouseSettings(exec: Executor = execPowerShell): Promise<MouseSettings> {
  const output = await exec(`${NATIVE_TYPE}${READ_VALUES}`);
  return parseMouseSettings(output);
}

export async function applyMouseSettings(
  settings: MouseSettings,
  exec: Executor = execPowerShell
): Promise<MouseSettings> {
  validateMouseSettings(settings);
  const output = await exec(buildApplyMouseSettingsScript(settings));
  return parseMouseSettings(output);
}
