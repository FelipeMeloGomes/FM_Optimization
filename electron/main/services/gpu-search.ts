import type { GpuCatalogEntry } from '../../shared/ipc-types';

/**
 * Busca pontual de uma placa no Technical City. Usada quando a GPU detectada
 * no PC do usuário não está no catálogo versionado: montamos o slug a partir
 * do nome reportado pelo Windows e lemos as mesmas tabelas usadas para gerar
 * o `resources/gpu-dataset.json`.
 */

const SEARCH_BASE_URL = 'https://technical.city/pt/gpu';
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; FM-Optimize/1.0)';

export interface GpuSearchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&minus;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .trim();
}

function row(html: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<tr><td>${escaped}</td><td>([\\s\\S]*?)</td></tr>`));
  if (!match) return undefined;
  const blue = match[1].match(/<em class="blue">([\s\S]*?)<\/em>/);
  return blue ? decode(blue[1]) : undefined;
}

function numberFrom(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : undefined;
}

/** Converte "NVIDIA GeForce RTX 4060 Ti 16GB" em "GeForce-RTX-4060-Ti-16-GB". */
export function buildGpuSlug(name: string): string | null {
  const slug = name
    .replace(/^(nvidia|amd|ati|intel)\s+/i, '')
    .replace(/\b(\d+)\s*gb\b/gi, '$1-GB')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // Whitelist rígida: o valor vai para a URL, então nada de barras ou query.
  return /^[a-zA-Z0-9-]{3,80}$/.test(slug) ? slug : null;
}

function displayName(slug: string): string {
  return slug
    .replace(/-(16|8|6|4|2)-GB$/i, ' $1 GB')
    .replace(/-D$/i, ' D')
    .replace(/-/g, ' ');
}

function manufacturerFor(slug: string): string {
  if (/^radeon/i.test(slug)) return 'AMD';
  if (/^arc/i.test(slug)) return 'Intel';
  return 'NVIDIA';
}

function parseEntry(html: string, slug: string): GpuCatalogEntry | null {
  const passmarkBlock = html.match(
    /<h4>Passmark<\/h4>[\s\S]*?class="avarage">([\s\S]*?)<div class="samples_text"/
  );
  const performanceScore = numberFrom(passmarkBlock ? decode(passmarkBlock[1]) : undefined);
  if (!performanceScore || performanceScore <= 0) return null;

  const text = (label: string) => row(html, label);
  const num = (label: string) => numberFrom(text(label));
  const optional = <K extends string, V>(key: K, value: V | undefined) =>
    value === undefined ? {} : { [key]: value };

  const architecture = text('Arquitetura')?.replace(/\s*\(.*\)\s*$/, '');
  const releaseYear = text('Data de lançamento')?.match(/\d{4}/)?.[0];

  return {
    id: slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    name: displayName(slug),
    manufacturer: manufacturerFor(slug),
    performanceScore,
    ...optional('architecture', architecture),
    ...optional('codename', text('Nome do código')),
    ...optional('vramGb', num('Capacidade máxima de memória RAM')),
    ...optional('vramType', text('Tipo de memória')),
    ...optional('memoryBusBits', num('Largura do barramento de memória')),
    ...optional('memoryBandwidthGbps', num('Largura de banda de memória')),
    ...optional('tdpWatts', num('Consumo de energia (TDP)')),
    ...optional('boostClockMhz', num('Frequência em modo Boost')),
    ...optional('shaderCount', num('Quantidade de processadores de sombreamento')),
    ...optional('processNm', num('Processo tecnológico de fabricação')),
    ...optional('releaseYear', releaseYear ? Number.parseInt(releaseYear, 10) : undefined),
  };
}

export async function searchGpu(
  name: string,
  options: GpuSearchOptions = {}
): Promise<GpuCatalogEntry | null> {
  const slug = buildGpuSlug(name);
  if (!slug) return null;

  try {
    const response = await (options.fetchFn ?? fetch)(`${SEARCH_BASE_URL}/${slug}`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) return null;
    return parseEntry(await response.text(), slug);
  } catch {
    return null;
  }
}
