import type { CpuVendor } from '../../shared/ipc-types';

/**
 * Normalização do nome do processador.
 *
 * O Windows pode devolver três coisas diferentes para a mesma CPU:
 * - o nome comercial (`AMD Ryzen 5 5500 6-Core Processor`);
 * - o identificador genérico do BIOS (`AMD64 Family 25 Model 80 Stepping 0`);
 * - um nome de máquina virtual (`Virtual CPU @ 2.40GHz`).
 *
 * A UI precisa de um rótulo curto e consistente, então a formatação vive aqui,
 * longe das telas, e é aplicada uma única vez no main process.
 */

export interface GenericCpuName {
  prefix: 'AMD64' | 'Intel64' | 'ARM64';
  family: string;
  modelNumber: string;
  stepping: string;
}

export interface CpuNameSources {
  wmiName?: string;
  osModel?: string;
  siBrand?: string;
  description?: string;
  vendor?: CpuVendor;
}

export interface ResolvedCpuName {
  name: string;
  raw: string;
  source: 'wmi' | 'os' | 'systeminformation' | 'generic' | 'unknown';
  generic: boolean;
  family?: string;
  modelNumber?: string;
  stepping?: string;
}

const GENERIC_NAME_PATTERN =
  /^(amd64|intel64|arm64)\s+family\s+(\d+)\s+model\s+(\d+)\s+stepping\s+(\d+)$/i;

const PLACEHOLDER_NAMES = [
  /^unknown$/i,
  /^to be filled by o\.?e\.?m\.?$/i,
  /^default string$/i,
  /^not specified$/i,
  /^not available$/i,
];

/** Espaços de padding do `os.cpus()` e quebras de linha não podem vazar para a UI. */
export function trimCpuName(value?: string): string {
  return (value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGenericCpuName(value: string): GenericCpuName | null {
  const match = trimCpuName(value).match(GENERIC_NAME_PATTERN);
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  return {
    prefix: prefix === 'AMD64' ? 'AMD64' : prefix === 'INTEL64' ? 'Intel64' : 'ARM64',
    family: match[2],
    modelNumber: match[3],
    stepping: match[4],
  };
}

export function isGenericCpuName(value: string): boolean {
  const trimmed = trimCpuName(value);
  if (!trimmed) return true;
  if (parseGenericCpuName(trimmed)) return true;
  return PLACEHOLDER_NAMES.some((pattern) => pattern.test(trimmed));
}

function isVirtualCpuName(value: string): boolean {
  return (
    /\b(?:virtual|vmware|qemu|kvm|virtualbox|parallels|hyper-v)\b/i.test(value) ||
    /\bmicrosoft hv\b/i.test(value)
  );
}

function formatSnapdragon(value: string): string | null {
  const match = value.match(/^snapdragon\s+(.+?)\s+-\s+([a-z0-9]+)\s+-\s+/i);
  if (!match) return null;
  return `Snapdragon ${match[1].trim()} ${match[2].toUpperCase()}`;
}

function formatGenericCpuName(info: GenericCpuName, vendor?: CpuVendor): string {
  const label =
    info.prefix === 'AMD64'
      ? 'AMD'
      : info.prefix === 'Intel64'
        ? 'Intel'
        : info.prefix === 'ARM64'
          ? 'ARM'
          : vendor === 'amd'
            ? 'AMD'
            : vendor === 'intel'
              ? 'Intel'
              : 'Processador';

  return `${label} (Família ${info.family} · Modelo ${info.modelNumber})`;
}

/**
 * Converte o nome bruto no padrão `Fabricante + Linha + Modelo`.
 *
 * A ordem das substituições importa: o clock precisa sair antes dos tokens
 * `CPU`/`Processor`, e a contagem de núcleos antes do sufixo `Processor`.
 */
export function formatCpuName(value: string, vendor?: CpuVendor): string {
  const trimmed = trimCpuName(value);
  if (!trimmed) return 'Unknown';

  const generic = parseGenericCpuName(trimmed);
  if (generic) return formatGenericCpuName(generic, vendor);

  // Marcas registradas primeiro: "Snapdragon(R)" e "Core(TM)2" viram
  // "Snapdragon" e "Core 2" antes de qualquer outra regra.
  const withoutTrademarks = trimmed
    .replace(/\s*\((?:R|TM|C)\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isVirtualCpuName(withoutTrademarks)) return 'CPU virtual';

  const snapdragon = formatSnapdragon(withoutTrademarks);
  if (snapdragon) return snapdragon;

  let name = withoutTrademarks;

  // "12th Gen Intel..." → "Intel..."
  name = name.replace(/^\d{1,2}(?:st|nd|rd|th)\s+Gen\s+/i, '');

  // "CPU @ 3.60GHz" / "@ 3.6 GHz" / "1000MHz"
  name = name.replace(/\s*(?:CPU\s*)?@\s*[\d.]+\s*(?:GHz|MHz)\s*$/i, '');

  // "8-Core Processor", "Eight-Core Processor", "Dual Core Processor"
  name = name.replace(
    /\s+(?:\d+|single|dual|triple|quad|six|eight|ten|twelve|sixteen|thirty-two)[- ]core(?:\s+processor)?\b/gi,
    ''
  );

  // "with Radeon Graphics", "w/ Radeon 890M", "with Radeon Vega Graphics"
  name = name.replace(/\s+(?:with|w\/)\s+.*(?:radeon|graphics).*$/i, '');

  // "Radeon R7, 10 Compute Cores 4C+6G" (APUs antigas)
  name = name.replace(/\s+radeon\s+.*$/i, '');

  // Tokens descritivos que sobram: "Opteron Processor", "Xeon CPU", "APU", "SOC"
  name = name.replace(/\s+(?:processor|cpu|apu|soc)\b/gi, '');

  name = name.replace(/\s+/g, ' ').trim();

  // Rede de segurança: nenhuma regra pode transformar um nome válido em vazio.
  return name.length >= 3 ? name : trimmed;
}

/**
 * Escolhe a melhor fonte disponível e aplica o padrão de exibição.
 *
 * Um nome genérico nunca vence um nome comercial, independentemente da ordem
 * das fontes: o WMI pode ser o primeiro a responder e ainda assim só ter o
 * identificador do BIOS.
 */
export function resolveCpuName(sources: CpuNameSources): ResolvedCpuName {
  const candidates = [
    { raw: trimCpuName(sources.wmiName), source: 'wmi' as const },
    { raw: trimCpuName(sources.osModel), source: 'os' as const },
    { raw: trimCpuName(sources.siBrand), source: 'systeminformation' as const },
  ].filter((candidate) => candidate.raw.length > 0);

  const specific = candidates.find((candidate) => !isGenericCpuName(candidate.raw));
  const generic = candidates.find((candidate) => isGenericCpuName(candidate.raw));
  const chosen = specific ?? generic;

  if (!chosen) {
    return { name: 'Unknown', raw: '', source: 'unknown', generic: true };
  }

  const parsed = parseGenericCpuName(chosen.raw) ?? parseGenericCpuName(sources.description ?? '');
  const isGeneric = isGenericCpuName(chosen.raw);

  return {
    name: formatCpuName(chosen.raw, sources.vendor),
    raw: chosen.raw,
    source: isGeneric ? 'generic' : chosen.source,
    generic: isGeneric,
    family: parsed?.family,
    modelNumber: parsed?.modelNumber,
    stepping: parsed?.stepping,
  };
}
