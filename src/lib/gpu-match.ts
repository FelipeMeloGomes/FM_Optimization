import type { GpuCatalogEntry } from '../../electron/shared/ipc-types';

/**
 * O nome vindo do WMI costuma trazer o fabricante ("NVIDIA GeForce RTX 4060"),
 * enquanto o catálogo usa "GeForce RTX 4060". Normalizar os dois lados permite
 * selecionar a placa do usuário sem depender de uma tabela de apelidos.
 */
export function normalizeGpuName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(nvidia|amd|ati|intel)\s+/i, '')
    .toLowerCase()
    .replace(/([0-9])gb\b/g, '$1 gb')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Encontra no catálogo a entrada que corresponde à placa detectada no Windows. */
export function findUserGpu(
  gpus: GpuCatalogEntry[],
  systemName: string | undefined
): GpuCatalogEntry | undefined {
  if (!systemName || gpus.length === 0) return undefined;

  const target = normalizeGpuName(systemName);
  if (!target) return undefined;

  const exact = gpus.find((gpu) => normalizeGpuName(gpu.name) === target);
  if (exact) return exact;

  // Segunda passada para sufixos que o Windows escreve diferente (16GB x 16 GB)
  // ou nomes com informação extra de OEM.
  const candidates = gpus.filter((gpu) => {
    const name = normalizeGpuName(gpu.name);
    return name.length > 3 && (target.includes(name) || name.includes(target));
  });

  return candidates.sort(
    (a, b) => normalizeGpuName(b.name).length - normalizeGpuName(a.name).length
  )[0];
}
