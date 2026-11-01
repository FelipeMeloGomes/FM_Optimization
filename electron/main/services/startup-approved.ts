/**
 * O Windows guarda o "desativado" da inicialização em um REG_BINARY de 12 bytes
 * em `Explorer\StartupApproved`. O primeiro byte é o estado: 0x02/0x06 ativo,
 * 0x03/0x07 desativado. O resto é o timestamp da última mudança, que não
 * precisamos reproduzir — zerado funciona e evita depender do relógio.
 */
const DISABLED_PREFIXES = new Set([0x03, 0x07]);

const ENABLED_HEX = '020000000000000000000000';
const DISABLED_HEX = '030000000000000000000000';

export function isStartupApprovedEnabled(base64Value: string | null | undefined): boolean {
  if (!base64Value) return true;
  const bytes = Buffer.from(base64Value, 'base64');
  if (bytes.length === 0) return true;
  return !DISABLED_PREFIXES.has(bytes[0]);
}

export function startupApprovedHex(enabled: boolean): string {
  return enabled ? ENABLED_HEX : DISABLED_HEX;
}
