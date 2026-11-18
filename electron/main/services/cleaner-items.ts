import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CleanerItemGroup, CleanerItemId } from '../../shared/cleaner-items';
import type { CleanerItemStats, CleanItemResult, CleanItemsResult } from '../../shared/ipc-types';

const execFileAsync = promisify(execFile);

const FILES_PER_BATCH = 32;
const MAX_DEPTH = 10;

export interface CleanerCommand {
  command: string;
  args: string[];
}

/**
 * Onde a limpeza age. `contents` preserva a pasta (Temp precisa continuar
 * existindo); `tree` apaga o diretório inteiro (cache de navegador).
 */
export interface CleanerTarget {
  dir: string;
  mode: 'contents' | 'tree';
  /**
   * Subpastas procuradas dentro de cada filho de `dir`. É o caso dos perfis do
   * Firefox: `Profiles\<perfil>\cache2` e `thumbnails`.
   */
  include?: string[];
}

export interface CleanerItemDefinition {
  id: CleanerItemId;
  label: string;
  description: string;
  group: CleanerItemGroup;
  requiresAdmin: boolean;
  targets: CleanerTarget[];
  /** Comandos que precisam rodar antes/depois da remoção (ex.: serviços do WU). */
  beforeCommands?: CleanerCommand[];
  afterCommands?: CleanerCommand[];
}

const TEMP_USER = process.env.TEMP ?? '';
const WINDIR = process.env.WINDIR ?? 'C:\\Windows';
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
const APPDATA = process.env.APPDATA ?? '';

const UPDATE_SERVICES = ['wuauserv', 'bits', 'cryptSvc', 'msiserver'];

function serviceCommands(action: 'stop' | 'start'): CleanerCommand[] {
  return UPDATE_SERVICES.map((service) => ({
    command: 'net',
    // `/y` só existe no stop: no start ele faria o comando falhar e o serviço
    // ficaria parado até o próximo boot.
    args: action === 'stop' ? [action, service, '/y'] : [action, service],
  }));
}

/**
 * Catálogo com os itens que conseguimos medir e limpar sem depender de
 * PowerShell. Serve de fonte única para a varredura e para a remoção — os
 * scripts `.bat` continuam existindo apenas para a limpeza agendada.
 */
export const CLEANER_ITEMS: readonly CleanerItemDefinition[] = [
  {
    id: 'temp-user',
    label: 'Temp do Usuário',
    description: 'Arquivos temporários criados pelos seus programas.',
    group: 'sistema',
    requiresAdmin: false,
    targets: [{ dir: TEMP_USER, mode: 'contents' }],
  },
  {
    id: 'temp-windows',
    label: 'Temp do Windows',
    description: 'Temporários do próprio Windows.',
    group: 'sistema',
    requiresAdmin: true,
    targets: [{ dir: join(WINDIR, 'Temp'), mode: 'contents' }],
  },
  {
    id: 'prefetch',
    label: 'Prefetch',
    description: 'Dados de inicialização de programas. O Windows recria o que precisar.',
    group: 'sistema',
    requiresAdmin: true,
    targets: [{ dir: join(WINDIR, 'Prefetch'), mode: 'contents' }],
  },
  {
    id: 'windows-update',
    label: 'Cache do Windows Update',
    description: 'Instaladores já baixados pelo Windows Update.',
    group: 'atualizacoes',
    requiresAdmin: true,
    targets: [{ dir: join(WINDIR, 'SoftwareDistribution', 'Download'), mode: 'contents' }],
    beforeCommands: serviceCommands('stop'),
    afterCommands: serviceCommands('start'),
  },
  {
    id: 'directx',
    label: 'Shaders DirectX',
    description: 'Cache de shaders de jogos e drivers de vídeo.',
    group: 'atualizacoes',
    requiresAdmin: false,
    targets: [
      { dir: join(LOCALAPPDATA, 'D3DSCache'), mode: 'contents' },
      { dir: join(LOCALAPPDATA, 'AMD', 'DxCache'), mode: 'contents' },
      { dir: join(LOCALAPPDATA, 'NVIDIA', 'DxCache'), mode: 'contents' },
      { dir: join(LOCALAPPDATA, 'Intel', 'ShaderCache'), mode: 'contents' },
    ],
  },
  {
    id: 'chrome',
    label: 'Cache do Google Chrome',
    description: 'Cache de páginas, imagens e scripts do Chrome.',
    group: 'navegadores',
    requiresAdmin: false,
    targets: [
      {
        dir: join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        mode: 'tree',
      },
    ],
  },
  {
    id: 'edge',
    label: 'Cache do Microsoft Edge',
    description: 'Cache de páginas, imagens e scripts do Edge.',
    group: 'navegadores',
    requiresAdmin: false,
    targets: [
      {
        dir: join(LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        mode: 'tree',
      },
    ],
  },
  {
    id: 'firefox',
    label: 'Cache do Mozilla Firefox',
    description: 'Cache e miniaturas de cada perfil do Firefox.',
    group: 'navegadores',
    requiresAdmin: false,
    targets: [
      {
        dir: join(APPDATA, 'Mozilla', 'Firefox', 'Profiles'),
        mode: 'tree',
        include: ['cache2', 'thumbnails'],
      },
    ],
  },
  {
    id: 'brave',
    label: 'Cache do Brave',
    description: 'Cache de páginas, imagens e scripts do Brave.',
    group: 'navegadores',
    requiresAdmin: false,
    targets: [
      {
        dir: join(LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cache'),
        mode: 'tree',
      },
    ],
  },
];

interface DirectoryScan {
  fileCount: number;
  totalSizeBytes: number;
}

interface ResolvedTarget {
  path: string;
  mode: CleanerTarget['mode'];
}

async function scanDirectory(dirPath: string, maxDepth = MAX_DEPTH): Promise<DirectoryScan> {
  if (!dirPath || maxDepth <= 0) return { fileCount: 0, totalSizeBytes: 0 };

  let fileCount = 0;
  let totalSizeBytes = 0;

  let entries: Dirent[];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return { fileCount: 0, totalSizeBytes: 0 };
  }

  const tasks = entries.map((entry) => {
    const fullPath = join(dirPath, entry.name);
    return (async (): Promise<DirectoryScan> => {
      try {
        if (entry.isDirectory()) return await scanDirectory(fullPath, maxDepth - 1);
        const info = await stat(fullPath);
        return { fileCount: 1, totalSizeBytes: info.size };
      } catch {
        return { fileCount: 0, totalSizeBytes: 0 };
      }
    })();
  });

  for (let i = 0; i < tasks.length; i += FILES_PER_BATCH) {
    const results = await Promise.all(tasks.slice(i, i + FILES_PER_BATCH));
    for (const result of results) {
      fileCount += result.fileCount;
      totalSizeBytes += result.totalSizeBytes;
    }
  }

  return { fileCount, totalSizeBytes };
}

/** Expande um alvo em diretórios concretos (perfis do Firefox, por exemplo). */
async function resolveTargets(target: CleanerTarget): Promise<ResolvedTarget[]> {
  if (!target.dir) return [];

  if (!target.include || target.include.length === 0) {
    return [{ path: target.dir, mode: target.mode }];
  }

  const children = await readdir(target.dir, { withFileTypes: true }).catch(() => []);
  const resolved: ResolvedTarget[] = [];
  for (const child of children) {
    if (!child.isDirectory()) continue;
    for (const name of target.include) {
      resolved.push({ path: join(target.dir, child.name, name), mode: 'tree' });
    }
  }
  return resolved;
}

export async function scanItem(item: CleanerItemDefinition): Promise<DirectoryScan> {
  let fileCount = 0;
  let totalSizeBytes = 0;

  for (const target of item.targets) {
    for (const resolved of await resolveTargets(target)) {
      const scan = await scanDirectory(resolved.path);
      fileCount += scan.fileCount;
      totalSizeBytes += scan.totalSizeBytes;
    }
  }

  return { fileCount, totalSizeBytes };
}

async function removeTarget(target: ResolvedTarget): Promise<void> {
  if (target.mode === 'tree') {
    await rm(target.path, { recursive: true, force: true, maxRetries: 2 }).catch(() => {});
    return;
  }

  const entries = await readdir(target.path, { withFileTypes: true }).catch(() => []);
  for (let i = 0; i < entries.length; i += FILES_PER_BATCH) {
    const batch = entries.slice(i, i + FILES_PER_BATCH);
    await Promise.all(
      batch.map((entry) =>
        rm(join(target.path, entry.name), {
          recursive: true,
          force: true,
          maxRetries: 2,
        }).catch(() => {})
      )
    );
  }
}

async function runCommands(commands: CleanerCommand[] | undefined): Promise<void> {
  if (!commands) return;
  for (const { command, args } of commands) {
    try {
      await execFileAsync(command, args, { windowsHide: true, timeout: 30_000 });
    } catch {
      // Serviço já parado/inexistente: a remoção continua valendo.
    }
  }
}

export async function getCleanerItemsStats(
  items: readonly CleanerItemDefinition[] = CLEANER_ITEMS
): Promise<CleanerItemStats[]> {
  return Promise.all(
    items.map(async (item): Promise<CleanerItemStats> => {
      const meta = {
        id: item.id,
        label: item.label,
        description: item.description,
        group: item.group,
        requiresAdmin: item.requiresAdmin,
      };

      try {
        const scan = await scanItem(item);
        return { ...meta, ...scan };
      } catch {
        return { ...meta, fileCount: 0, totalSizeBytes: 0, error: true };
      }
    })
  );
}

export interface CleanItemsOptions {
  /** Catálogo alternativo — usado pelos testes com pastas temporárias. */
  items?: readonly CleanerItemDefinition[];
  /**
   * Se o processo está elevado. Obrigatório de propósito: quem chama decide
   * (e o IPC passa `isAdmin()`), então o serviço não depende do módulo
   * `electron` nem pode esquecer a checagem em silêncio.
   */
  elevated: boolean;
}

/**
 * Limpa os itens pedidos, um por um, e devolve quanto saiu do disco.
 *
 * O cálculo é pré/pós-varredura em vez de somar `stat` de cada arquivo: assim
 * arquivos travados (em uso pelo navegador) simplesmente não entram na conta e
 * um item com falha não impede os outros de serem limpos.
 */
export async function cleanItems(
  ids: readonly string[],
  options: CleanItemsOptions
): Promise<CleanItemsResult> {
  const catalog = options.items ?? CLEANER_ITEMS;
  const elevated = options.elevated;

  const wanted = new Set(ids);
  const unknown = [...wanted].filter((id) => !catalog.some((item) => item.id === id));
  if (unknown.length > 0) {
    throw new Error(`Item de limpeza desconhecido: ${unknown.join(', ')}`);
  }

  const selected = catalog.filter((item) => wanted.has(item.id));
  if (selected.length === 0) {
    throw new Error('Nenhum item selecionado para limpar');
  }

  const blocked = selected.filter((item) => item.requiresAdmin && !elevated);
  if (blocked.length > 0) {
    throw new Error(
      `Requer administrador: ${blocked.map((item) => item.label).join(', ')}. Reinicie o app como administrador.`
    );
  }

  const results: CleanItemResult[] = [];

  for (const item of selected) {
    const before = await scanItem(item);

    // Nada para apagar: não vale parar serviço do Windows Update nem varrer de
    // novo. Item vazio é resultado zerado, não falha.
    if (before.fileCount === 0) {
      results.push({ id: item.id, label: item.label, freedBytes: 0, removedFiles: 0 });
      continue;
    }

    let error: string | undefined;

    try {
      await runCommands(item.beforeCommands);
      for (const target of item.targets) {
        for (const resolved of await resolveTargets(target)) {
          await removeTarget(resolved);
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      await runCommands(item.afterCommands);
    }

    const after = await scanItem(item);

    results.push({
      id: item.id,
      label: item.label,
      freedBytes: Math.max(0, before.totalSizeBytes - after.totalSizeBytes),
      removedFiles: Math.max(0, before.fileCount - after.fileCount),
      ...(error ? { error } : {}),
    });
  }

  return {
    items: results,
    freedBytes: results.reduce((total, item) => total + item.freedBytes, 0),
    removedFiles: results.reduce((total, item) => total + item.removedFiles, 0),
    failed: results.filter((item) => item.error !== undefined).length,
  };
}
