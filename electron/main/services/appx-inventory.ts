import { appxDisplayName, appxProtectionReason, isRecommendedAppx } from '../../shared/appx';
import type {
  AppxInventory,
  AppxPackageInfo,
  AppxRemoveFailure,
  AppxRemoveResult,
} from '../../shared/ipc-types';
import { execPowerShell } from './powershell';

/**
 * Inventário dos apps Appx (Store/UWP) e remoção em lote.
 *
 * A leitura usa `Get-AppxPackage -AllUsers` quando o app está elevado e cai
 * para o usuário atual quando não está. `Get-AppxProvisionedPackage` mostra o
 * que voltaria após um update do Windows; as duas listas são fundidas por
 * `PackageFamilyName`, que é a identidade usada no IPC.
 *
 * A remoção recebe só famílias, resolve os nomes completos aqui e recusa
 * qualquer app protegido — o renderer nunca manda um comando ou caminho.
 */

export type PowerShellRunner = (script: string, timeout?: number) => Promise<string>;

const SCAN_TIMEOUT_MS = 120_000;
const CACHE_TTL_MS = 60_000;

/** PackageFamilyName: nome + publisher id, sem espaços nem aspas. */
const FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;

export interface AppxInventoryOptions {
  /** Obrigatório: quem chama decide (o IPC passa `isAdmin()`). */
  elevated: boolean;
  /** Ignora o cache e varre de novo (botão "Atualizar inventário"). */
  refresh?: boolean;
  runPowerShell?: PowerShellRunner;
  now?: () => number;
}

export interface RemoveAppxOptions {
  elevated: boolean;
  runPowerShell?: PowerShellRunner;
  now?: () => number;
}

interface RawInstalled {
  Name?: string;
  PackageFullName?: string;
  PackageFamilyName?: string;
  Version?: string;
  Publisher?: string;
  IsFramework?: boolean;
  NonRemovable?: boolean;
  SignatureKind?: string;
  /** Nome do manifesto; pode vir `ms-resource:...` (não resolvido). */
  DisplayName?: string;
  InstallLocation?: string;
}

interface RawProvisioned {
  DisplayName?: string;
  PackageName?: string;
  PackageFamilyName?: string;
  Version?: string;
  Publisher?: string;
}

interface ParsedInventory {
  installed: RawInstalled[];
  provisioned: RawProvisioned[];
}

interface CacheEntry {
  inventory: AppxInventory;
}

let cache: CacheEntry | null = null;

/** Usado pelo IPC depois de remover e pelos testes para isolar a varredura. */
export function clearAppxInventoryCache(): void {
  cache = null;
}

function buildScanScript(elevated: boolean): string {
  const installed = elevated ? 'Get-AppxPackage -AllUsers' : 'Get-AppxPackage';
  return [
    `$installed = @(${installed} -ErrorAction SilentlyContinue | ForEach-Object {`,
    `  $displayName = ''`,
    `  try {`,
    `    $manifest = Get-AppxPackageManifest -Package $_.PackageFullName -ErrorAction Stop`,
    `    $displayName = [string]$manifest.Package.Properties.DisplayName`,
    `  } catch {`,
    `    $displayName = ''`,
    `  }`,
    `  [pscustomobject]@{`,
    `    Name = $_.Name`,
    `    PackageFullName = $_.PackageFullName`,
    `    PackageFamilyName = $_.PackageFamilyName`,
    `    Version = [string]$_.Version`,
    `    Publisher = $_.Publisher`,
    `    IsFramework = $_.IsFramework`,
    `    NonRemovable = $_.NonRemovable`,
    `    SignatureKind = $_.SignatureKind`,
    `    InstallLocation = $_.InstallLocation`,
    `    DisplayName = $displayName`,
    `  }`,
    `})`,
    // Sem admin o DISM recusa -Online; a lista de provisionados fica vazia.
    elevated
      ? `$provisioned = @(Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Select-Object DisplayName, PackageName, PackageFamilyName, Version, Publisher)`
      : '$provisioned = @()',
    `[pscustomobject]@{ installed = @($installed); provisioned = @($provisioned) } | ConvertTo-Json -Depth 4 -Compress`,
  ].join('\n');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `ConvertTo-Json` devolve objeto quando a lista tem um item. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseInventoryOutput(output: string): ParsedInventory {
  const trimmed = output.trim();
  if (trimmed === '') return { installed: [], provisioned: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      'Resposta inválida do PowerShell ao listar apps Appx. Tente atualizar o inventário.'
    );
  }

  if (parsed === null) return { installed: [], provisioned: [] };
  if (!isObject(parsed)) {
    throw new Error('Resposta inválida do PowerShell ao listar apps Appx. Tente atualizar.');
  }

  return {
    installed: asArray(parsed.installed).filter(isObject) as RawInstalled[],
    provisioned: asArray(parsed.provisioned).filter(isObject) as RawProvisioned[],
  };
}

function familyFromProvisioned(pkg: RawProvisioned): string | undefined {
  if (pkg.PackageFamilyName) return pkg.PackageFamilyName;
  const full = pkg.PackageName;
  if (!full) return undefined;
  const parts = full.split('_');
  if (parts.length < 2 || !parts[0]) return undefined;
  return `${parts[0]}_${parts[parts.length - 1]}`;
}

function packageNameFromFamily(familyName: string): string {
  return familyName.split('_')[0] || familyName;
}

interface MergedAppx {
  familyName: string;
  packageName: string;
  version: string;
  publisher: string;
  isFramework: boolean;
  isProvisioned: boolean;
  nonRemovable: boolean;
  manifestDisplayName?: string;
  provisionedDisplayName?: string;
  installLocation?: string;
}

function toPackages({ installed, provisioned }: ParsedInventory): AppxPackageInfo[] {
  const byFamily = new Map<string, MergedAppx>();

  for (const pkg of installed) {
    if (!pkg.PackageFamilyName) continue;

    byFamily.set(pkg.PackageFamilyName, {
      familyName: pkg.PackageFamilyName,
      packageName: pkg.Name || packageNameFromFamily(pkg.PackageFamilyName),
      version: String(pkg.Version ?? ''),
      publisher: pkg.Publisher ?? '',
      isFramework: pkg.IsFramework === true,
      isProvisioned: false,
      nonRemovable: pkg.NonRemovable === true,
      ...(pkg.DisplayName ? { manifestDisplayName: pkg.DisplayName } : {}),
      ...(pkg.InstallLocation ? { installLocation: pkg.InstallLocation } : {}),
    });
  }

  for (const pkg of provisioned) {
    const familyName = familyFromProvisioned(pkg);
    if (!familyName) continue;

    const existing = byFamily.get(familyName);
    if (existing) {
      existing.isProvisioned = true;
      if (pkg.DisplayName) existing.provisionedDisplayName = pkg.DisplayName;
      if (!existing.version) existing.version = String(pkg.Version ?? '');
      if (!existing.publisher && pkg.Publisher) existing.publisher = pkg.Publisher;
      continue;
    }

    byFamily.set(familyName, {
      familyName,
      packageName: packageNameFromFamily(familyName),
      version: String(pkg.Version ?? ''),
      publisher: pkg.Publisher ?? '',
      isFramework: false,
      isProvisioned: true,
      nonRemovable: false,
      ...(pkg.DisplayName ? { provisionedDisplayName: pkg.DisplayName } : {}),
    });
  }

  const packages = [...byFamily.values()].map((merged): AppxPackageInfo => {
    const protectionReason = appxProtectionReason({
      packageName: merged.packageName,
      isFramework: merged.isFramework,
      nonRemovable: merged.nonRemovable,
      publisher: merged.publisher,
    });

    return {
      familyName: merged.familyName,
      packageName: merged.packageName,
      displayName: appxDisplayName({
        packageName: merged.packageName,
        displayName: merged.manifestDisplayName,
        provisionedDisplayName: merged.provisionedDisplayName,
        installLocation: merged.installLocation,
      }),
      version: merged.version,
      publisher: merged.publisher,
      isFramework: merged.isFramework,
      isProvisioned: merged.isProvisioned,
      removable: protectionReason === undefined,
      ...(protectionReason ? { protectionReason } : {}),
      recommended: false,
    };
  });

  for (const app of packages) {
    app.recommended = app.removable && isRecommendedAppx(app.packageName);
  }

  return packages.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
  );
}

export async function getAppxInventory(options: AppxInventoryOptions): Promise<AppxInventory> {
  const now = options.now ?? Date.now;
  const elevated = options.elevated;

  if (!options.refresh && cache) {
    const age = now() - cache.inventory.scannedAt;
    if (cache.inventory.elevated === elevated && age >= 0 && age <= CACHE_TTL_MS) {
      return cache.inventory;
    }
  }

  const run = options.runPowerShell ?? execPowerShell;
  const output = await run(buildScanScript(elevated), SCAN_TIMEOUT_MS);
  const inventory: AppxInventory = {
    packages: toPackages(parseInventoryOutput(output)),
    elevated,
    scannedAt: now(),
  };

  cache = { inventory };
  return inventory;
}

function buildRemovalScript(families: readonly string[]): string {
  const list = families.map((family) => `'${family}'`).join(', ');
  return `$families = @(${list})
$results = foreach ($family in $families) {
  try {
    $packages = @(Get-AppxPackage -AllUsers -ErrorAction Stop | Where-Object { $_.PackageFamilyName -eq $family })
    if ($packages.Count -eq 0) { throw 'Pacote nao encontrado para este usuario' }
    foreach ($package in $packages) { $package | Remove-AppxPackage -AllUsers -ErrorAction Stop }
    $parts = $family.Split('_')
    $provisioned = @(Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { ($_.PackageName.Split('_')[0] -eq $parts[0]) -and ($_.PackageName.Split('_')[-1] -eq $parts[-1]) })
    foreach ($package in $provisioned) { Remove-AppxProvisionedPackage -Online -PackageName $package.PackageName -ErrorAction SilentlyContinue | Out-Null }
    [pscustomobject]@{ familyName = $family; success = $true }
  } catch {
    [pscustomobject]@{ familyName = $family; success = $false; error = $_.Exception.Message }
  }
}
@($results) | ConvertTo-Json -Depth 3 -Compress`;
}

interface RawRemovalResult {
  familyName?: string;
  success?: boolean;
  error?: string;
}

function parseRemovalOutput(output: string, families: readonly string[]): AppxRemoveResult {
  const trimmed = output.trim();
  let results: RawRemovalResult[] = [];

  if (trimmed !== '' && trimmed !== 'null') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Resposta inválida do PowerShell ao remover apps. Confira o inventário.');
    }
    if (parsed !== null) {
      results = (Array.isArray(parsed) ? parsed : [parsed]).filter(isObject) as RawRemovalResult[];
    }
  }

  const byFamily = new Map<string, RawRemovalResult>();
  for (const result of results) {
    if (result.familyName) byFamily.set(result.familyName, result);
  }

  const removed: string[] = [];
  const failed: AppxRemoveFailure[] = [];

  for (const family of families) {
    const result = byFamily.get(family);
    if (!result) {
      failed.push({ familyName: family, error: 'O Windows não respondeu para este app.' });
      continue;
    }
    if (result.success === true) {
      removed.push(family);
      continue;
    }
    failed.push({
      familyName: family,
      error: result.error?.trim() || 'Falha ao remover o app.',
    });
  }

  return { removed, failed };
}

export async function removeAppxPackages(
  families: readonly string[],
  options: RemoveAppxOptions
): Promise<AppxRemoveResult> {
  if (!options.elevated) {
    throw new Error('Requer administrador. Reinicie o app como administrador para remover apps.');
  }

  const unique = [...new Set(families)];
  if (unique.length === 0) throw new Error('Nenhum app selecionado para remover');

  for (const family of unique) {
    if (!FAMILY_PATTERN.test(family)) {
      throw new Error(`Família inválida: ${family}`);
    }
  }

  const inventory = await getAppxInventory({
    elevated: true,
    runPowerShell: options.runPowerShell,
    now: options.now,
  });

  const byFamily = new Map(inventory.packages.map((app) => [app.familyName, app]));
  const unknown = unique.filter((family) => !byFamily.has(family));
  if (unknown.length > 0) {
    throw new Error(`App desconhecido no inventário: ${unknown.join(', ')}. Atualize a lista.`);
  }

  const protectedApps = unique
    .map((family) => byFamily.get(family))
    .filter((app): app is AppxPackageInfo => app !== undefined && !app.removable);
  if (protectedApps.length > 0) {
    throw new Error(
      `App protegido e não pode ser removido: ${protectedApps
        .map((app) => `${app.displayName} (${app.familyName})`)
        .join(', ')}`
    );
  }

  const run = options.runPowerShell ?? execPowerShell;
  const output = await run(buildRemovalScript(unique), SCAN_TIMEOUT_MS);
  const result = parseRemovalOutput(output, unique);

  cache = null;
  return result;
}
