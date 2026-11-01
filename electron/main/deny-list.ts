export const DENY_LIST_PATTERNS = [
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bdel\s+\/f\s+\/s\s+\/q\s+[cC]:/i,
  /\brmdir\s+\/s\s+\/q\s+[cC]:/i,
  /reg\s+delete\s+HKLM\\/i,
  /reg\s+delete\s+HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/i,
  /Start-Process\s+-Verb\s+runas/i,
  /\brunas\s+/i,
  /\belevate\b/i,
  /Invoke-Expression\b/i,
  /\biex\b/i,
  /Invoke-WebRequest\s+-OutFile/i,
  /\bwget\s+/i,
  /\bcurl\s+-o/i,
  /downloadstring/i,
  /Net\.WebClient/i,
  /System\.Net\.Http/i,
  /sc\s+stop\s+(wuauserv|wscsvc|windefend|mpssvc)/i,
  /Stop-Service\s+(wuauserv|wscsvc|windefend|mpssvc)/i,
  /\bbcdedit\b/i,
  /\bbootrec\b/i,
  /net\s+user\s+\/\s*add/i,
  /net\s+localgroup\s+administrators\s+\/\s*add/i,
  /netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off/i,
  /Set-NetFirewallProfile\s+-Enabled\s+False/i,
];

export const ALLOWED_EXTENSIONS = ['.bat', '.cmd', '.ps1', '.reg', '.exe'] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export function checkScriptContent(content: string): { allowed: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of DENY_LIST_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(pattern.source);
    }
  }
  return { allowed: violations.length === 0, violations };
}

/**
 * O catálogo é conteúdo interno e versionado — vários scripts legítimos usam
 * `bcdedit` ou param serviços sensíveis de propósito. Bloquear por padrão
 * quebraria o catálogo inteiro, então a decisão fica na flag de segurança.
 */
export function shouldBlockScript(
  violations: readonly string[],
  enableDenyListBlock: boolean
): boolean {
  return enableDenyListBlock && violations.length > 0;
}

export function isExtensionAllowed(ext: string): ext is AllowedExtension {
  return ALLOWED_EXTENSIONS.includes(ext.toLowerCase() as AllowedExtension);
}
