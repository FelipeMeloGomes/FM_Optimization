import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CleanerItemDefinition } from '../services/cleaner-items';
import { cleanItems, getCleanerItemsStats } from '../services/cleaner-items';

/**
 * A limpeza por item é o núcleo da página: varredura (contagem/tamanho),
 * remoção de verdade no disco e recusa quando o item exige administrador.
 * O catálogo é injetado para os testes apontarem para pastas temporárias.
 */

let root = '';

function item(overrides: Partial<CleanerItemDefinition> & Pick<CleanerItemDefinition, 'id'>) {
  return {
    label: overrides.id,
    description: '',
    group: 'sistema' as const,
    requiresAdmin: false,
    targets: [],
    ...overrides,
  } satisfies CleanerItemDefinition;
}

async function write(path: string, content: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content, 'utf-8');
}

function catalog(): CleanerItemDefinition[] {
  return [
    item({
      id: 'temp-user',
      label: 'Temp do Usuário',
      targets: [{ dir: join(root, 'temp'), mode: 'contents' }],
    }),
    item({
      id: 'chrome',
      label: 'Cache do Chrome',
      group: 'navegadores',
      targets: [{ dir: join(root, 'chrome-cache'), mode: 'tree' }],
    }),
    item({
      id: 'firefox',
      label: 'Cache do Firefox',
      group: 'navegadores',
      targets: [
        {
          dir: join(root, 'profiles'),
          mode: 'tree',
          include: ['cache2', 'thumbnails'],
        },
      ],
    }),
    item({
      id: 'temp-windows',
      label: 'Temp do Windows',
      requiresAdmin: true,
      targets: [{ dir: join(root, 'wintemp'), mode: 'contents' }],
    }),
  ];
}

async function seed(): Promise<void> {
  await write(join(root, 'temp', 'a.txt'), 'aaaaa');
  await write(join(root, 'temp', 'sub', 'b.txt'), '1234567');
  await write(join(root, 'chrome-cache', 'cache.bin'), '0123456789');
  await write(join(root, 'profiles', 'default', 'cache2', 'entries', 'c.bin'), 'abc');
  await write(join(root, 'profiles', 'default', 'thumbnails', 't.bin'), 'abcd');
  await write(join(root, 'profiles', 'default', 'prefs.js'), 'nao pode apagar');
  await write(join(root, 'wintemp', 'x.tmp'), 'zz');
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fm-cleaner-items-'));
  await seed();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('getCleanerItemsStats', () => {
  it('conta arquivos e tamanho de cada item, com os metadados do catálogo', async () => {
    const stats = await getCleanerItemsStats(catalog());

    const temp = stats.find((entry) => entry.id === 'temp-user');
    expect(temp).toMatchObject({
      label: 'Temp do Usuário',
      group: 'sistema',
      requiresAdmin: false,
      fileCount: 2,
      totalSizeBytes: 12,
    });

    const chrome = stats.find((entry) => entry.id === 'chrome');
    expect(chrome?.fileCount).toBe(1);
    expect(chrome?.totalSizeBytes).toBe(10);
  });

  it('lê só cache2 e thumbnails de cada perfil do Firefox', async () => {
    const stats = await getCleanerItemsStats(catalog());
    const firefox = stats.find((entry) => entry.id === 'firefox');

    // prefs.js fica de fora: não é cache.
    expect(firefox?.fileCount).toBe(2);
    expect(firefox?.totalSizeBytes).toBe(7);
  });

  it('devolve zero (sem erro) para item cuja pasta não existe', async () => {
    const stats = await getCleanerItemsStats([
      item({ id: 'prefetch', targets: [{ dir: join(root, 'inexistente'), mode: 'contents' }] }),
    ]);

    expect(stats[0]).toMatchObject({ fileCount: 0, totalSizeBytes: 0 });
    expect(stats[0].error).toBeUndefined();
  });
});

describe('cleanItems', () => {
  it('limpa só os arquivos escolhidos e devolve o total liberado', async () => {
    const result = await cleanItems(['temp-user'], { items: catalog(), elevated: true });

    expect(result.freedBytes).toBe(12);
    expect(result.removedFiles).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.items).toEqual([
      {
        id: 'temp-user',
        label: 'Temp do Usuário',
        freedBytes: 12,
        removedFiles: 2,
      },
    ]);

    // A pasta Temp continua existindo, só o conteúdo saiu.
    await expect(stat(join(root, 'temp'))).resolves.toBeDefined();
    await expect(stat(join(root, 'temp', 'a.txt'))).rejects.toThrow();
  });

  it('preserva o diretório do cache de navegador ausente e apaga o que existir', async () => {
    await cleanItems(['chrome'], { items: catalog(), elevated: true });

    await expect(stat(join(root, 'chrome-cache'))).rejects.toThrow();
  });

  it('não toca nas preferências do perfil ao limpar o cache do Firefox', async () => {
    const result = await cleanItems(['firefox'], { items: catalog(), elevated: true });

    expect(result.freedBytes).toBe(7);
    await expect(stat(join(root, 'profiles', 'default', 'cache2'))).rejects.toThrow();
    await expect(stat(join(root, 'profiles', 'default', 'thumbnails'))).rejects.toThrow();
    await expect(readFile(join(root, 'profiles', 'default', 'prefs.js'), 'utf-8')).resolves.toBe(
      'nao pode apagar'
    );
  });

  it('recusa item que exige administrador quando o app não está elevado', async () => {
    await expect(
      cleanItems(['temp-windows'], { items: catalog(), elevated: false })
    ).rejects.toThrow(/Requer administrador: Temp do Windows/);

    // Nada foi apagado antes da recusa.
    await expect(stat(join(root, 'wintemp', 'x.tmp'))).resolves.toBeDefined();
  });

  it('limpa item de sistema quando elevado', async () => {
    const result = await cleanItems(['temp-windows'], { items: catalog(), elevated: true });

    expect(result.freedBytes).toBe(2);
    await expect(stat(join(root, 'wintemp', 'x.tmp'))).rejects.toThrow();
  });

  it('recusa id fora do catálogo sem limpar nada', async () => {
    await expect(
      cleanItems(['temp-user', 'navegador-inventado'], { items: catalog(), elevated: true })
    ).rejects.toThrow('Item de limpeza desconhecido: navegador-inventado');

    await expect(stat(join(root, 'temp', 'a.txt'))).resolves.toBeDefined();
  });

  it('recusa lista vazia', async () => {
    await expect(cleanItems([], { items: catalog(), elevated: true })).rejects.toThrow(
      'Nenhum item selecionado'
    );
  });

  it('não roda comandos nem revarre quando o item já está vazio', async () => {
    const marker = join(root, 'comando-rodou.txt');
    const emptyDir = join(root, 'cache-vazio');
    await mkdir(emptyDir, { recursive: true });

    const result = await cleanItems(['windows-update'], {
      items: [
        item({
          id: 'windows-update',
          requiresAdmin: true,
          targets: [{ dir: emptyDir, mode: 'contents' }],
          beforeCommands: [{ command: 'cmd', args: ['/c', `echo x > "${marker}"`] }],
        }),
      ],
      elevated: true,
    });

    expect(result).toEqual({
      items: [{ id: 'windows-update', label: 'windows-update', freedBytes: 0, removedFiles: 0 }],
      freedBytes: 0,
      removedFiles: 0,
      failed: 0,
    });
    await expect(stat(marker)).rejects.toThrow();
  });

  it('soma itens independentes em uma única execução', async () => {
    const result = await cleanItems(['temp-user', 'firefox'], {
      items: catalog(),
      elevated: true,
    });

    expect(result.freedBytes).toBe(19);
    expect(result.removedFiles).toBe(4);
    expect(result.items).toHaveLength(2);
  });
});
