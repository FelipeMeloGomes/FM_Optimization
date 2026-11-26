import {
  KEYBOARD_BLINK_MAX,
  KEYBOARD_BLINK_MIN,
  KEYBOARD_REPEAT_DELAY_MAX,
  KEYBOARD_REPEAT_DELAY_MIN,
  KEYBOARD_REPEAT_RATE_MAX,
  KEYBOARD_REPEAT_RATE_MIN,
  type KeyboardSettings,
} from '../../shared/keyboard-settings';
import { isIntegerInRange } from '../utils/numeric';
import { parsePowerShellJson } from '../utils/powershell-json';
import { execPowerShell } from './powershell';

type Executor = (script: string, timeout?: number) => Promise<string>;

const NATIVE_TYPE = `$nativeSource = @'
using System;
using System.Runtime.InteropServices;
public static class FmOptimizeKeyboard {
  [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
  public static extern bool GetSystemParameter(uint action, uint param, out uint value, uint flags);
  [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
  public static extern bool SetSystemParameter(uint action, uint param, IntPtr value, uint flags);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCaretBlinkTime(uint ms);
  [DllImport("user32.dll")]
  public static extern uint GetCaretBlinkTime();
}
'@
if (-not ('FmOptimizeKeyboard' -as [type])) { Add-Type -TypeDefinition $nativeSource }
`;

const READ_VALUES = `
$repeatDelay = 0
$repeatRate = 0
if (-not [FmOptimizeKeyboard]::GetSystemParameter(0x0016, 0, [ref]$repeatDelay, 0)) {
  throw 'Não foi possível ler o atraso de repetição do Windows'
}
if (-not [FmOptimizeKeyboard]::GetSystemParameter(0x000A, 0, [ref]$repeatRate, 0)) {
  throw 'Não foi possível ler a velocidade de repetição do Windows'
}
$blinkRate = [FmOptimizeKeyboard]::GetCaretBlinkTime()

[pscustomobject]@{
  repeatDelay = $repeatDelay
  repeatRate = $repeatRate
  caretBlinkRate = $blinkRate
} | ConvertTo-Json -Compress
`;

/** Valida tanto a resposta do Windows quanto o payload que veio do renderer. */
export function validateKeyboardSettings(value: unknown): KeyboardSettings {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Configurações do teclado inválidas');
  }
  const candidate = value as Record<string, unknown>;
  const { repeatDelay, repeatRate, caretBlinkRate } = candidate;

  if (
    !('repeatDelay' in candidate) ||
    !('repeatRate' in candidate) ||
    !('caretBlinkRate' in candidate)
  ) {
    throw new Error('Configurações do teclado inválidas');
  }
  if (!isIntegerInRange(repeatDelay, KEYBOARD_REPEAT_DELAY_MIN, KEYBOARD_REPEAT_DELAY_MAX)) {
    throw new Error('Atraso de repetição inválido');
  }
  if (!isIntegerInRange(repeatRate, KEYBOARD_REPEAT_RATE_MIN, KEYBOARD_REPEAT_RATE_MAX)) {
    throw new Error('Repetição de tecla inválida');
  }
  if (!isIntegerInRange(caretBlinkRate, KEYBOARD_BLINK_MIN, KEYBOARD_BLINK_MAX)) {
    throw new Error('Piscagem do cursor inválida');
  }

  return { repeatDelay, repeatRate, caretBlinkRate };
}

export function parseKeyboardSettings(raw: string): KeyboardSettings {
  const parsed = parsePowerShellJson(raw, { label: 'configurações do teclado' });
  return validateKeyboardSettings(parsed);
}

export function buildReadKeyboardSettingsScript(): string {
  return `${NATIVE_TYPE}${READ_VALUES}`;
}

export function buildApplyKeyboardSettingsScript(settings: KeyboardSettings): string {
  const valid = validateKeyboardSettings(settings);
  return `${NATIVE_TYPE}
# SPIF_UPDATEINIFILE | SPIF_SENDCHANGE: aplica e salva no perfil do usuário.
if (-not [FmOptimizeKeyboard]::SetSystemParameter(0x0017, ${valid.repeatDelay}, [IntPtr]::Zero, 0x3)) {
  throw 'O Windows recusou o atraso de repetição'
}
if (-not [FmOptimizeKeyboard]::SetSystemParameter(0x000B, ${valid.repeatRate}, [IntPtr]::Zero, 0x3)) {
  throw 'O Windows recusou a velocidade de repetição'
}
# SetCaretBlinkTime muda a sessão atual; o registro garante depois do logon.
Set-ItemProperty 'HKCU:Control PanelDesktop' -Name CursorBlinkRate -Value "$(${
    valid.caretBlinkRate
  })"
if (-not [FmOptimizeKeyboard]::SetCaretBlinkTime(${valid.caretBlinkRate})) {
  throw 'O Windows recusou a piscagem do cursor'
}
${READ_VALUES}`;
}

export async function readKeyboardSettings(
  exec: Executor = execPowerShell
): Promise<KeyboardSettings> {
  return parseKeyboardSettings(await exec(buildReadKeyboardSettingsScript()));
}

export async function applyKeyboardSettings(
  settings: KeyboardSettings,
  exec: Executor = execPowerShell
): Promise<KeyboardSettings> {
  validateKeyboardSettings(settings);
  return parseKeyboardSettings(await exec(buildApplyKeyboardSettingsScript(settings)));
}
