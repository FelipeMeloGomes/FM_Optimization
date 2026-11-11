import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type AfterPackContext = { appOutDir: string; electronPlatformName: string };

type AfterPackModule = {
  (context: AfterPackContext): Promise<void>;
  removeUnusedRuntime: (context: { appOutDir: string }) => string[];
  UNUSED_RUNTIME_FILES: string[];
};

/**
 * O `app.asar` chegou a 395 MB porque o `files` do electron-builder so tinha
 * negacoes (o default incluia o repositorio inteiro: `data/`, `docs/` e ate o
 * `.env.local`) e porque `dependencies` acumulou pins de seguranca e libs de
 * renderer que o Vite ja empacota. Estes testes travam esse contrato.
 */

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function listSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listSources(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

function mainProcessSource(): string {
  const files = listSources(join(repoRoot, 'electron', 'main'));
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

type AsarNode = { files?: Record<string, AsarNode> };

/** Lista os caminhos de arquivo dentro de um app.asar (sem extrair). */
function asarFileList(asarPath: string): string[] {
  const fd = openSync(asarPath, 'r');
  try {
    const header = Buffer.alloc(16);
    readSync(fd, header, 0, 16, 0);
    const jsonSize = header.readUInt32LE(12);
    const json = Buffer.alloc(jsonSize);
    readSync(fd, json, 0, jsonSize, 16);

    const tree = JSON.parse(json.toString('utf8')) as AsarNode;
    const files: string[] = [];

    const walk = (node: AsarNode, prefix: string) => {
      for (const [name, child] of Object.entries(node.files ?? {})) {
        const full = prefix ? `${prefix}/${name}` : name;
        if (child.files) walk(child, full);
        else files.push(full);
      }
    };

    walk(tree, '');
    return files;
  } finally {
    closeSync(fd);
  }
}

describe('configuracao de empacotamento', () => {
  it('empacota apenas out/, package.json e node_modules', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain('out/**/*');
    expect(config).toContain('package.json');
    expect(config).toContain('node_modules/**/*');
  });

  it('nao usa o glob amplo que empacotava o repositorio inteiro', () => {
    const config = readText('electron-builder.yml');
    const fileSection = config.split('files:')[1]?.split(/\n[a-z]/)[0] ?? '';

    expect(fileSection).not.toMatch(/^\s*-\s*['"]?\*\*\/\*['"]?\s*$/m);
    expect(fileSection).not.toContain('!**/.vscode/*');
  });

  it('exclui arquivos de ambiente do pacote', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain("'!**/.env*'");
  });

  it('exclui artefatos de build do pacote', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain("'!**/*.tsbuildinfo'");
    expect(config).toContain("'!**/*.map'");
  });

  it('mantem apenas os locales usados pelo app', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain('electronLanguages:');
    expect(config).toContain('pt-BR');
    expect(config).toContain('en-US');
  });

  it('comprime o instalador no maximo', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain('compression: maximum');
  });

  it('exclui o codigo-fonte TypeScript que alguns pacotes publicam', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain("'!**/node_modules/zod/src/**'");
    // `debug` usa `src/index.js` como main: um filtro generico de src quebra o boot.
    expect(config).not.toContain("'!**/node_modules/*/src/**'");
  });

  it('remove o dxcompiler.dll via hook afterPack', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain('afterPack: scripts/after-pack.cjs');
  });

  it('mantem em dependencies somente pacotes usados pelo main', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      dependencies?: Record<string, string>;
    };
    const source = mainProcessSource();

    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      const used =
        source.includes(`from '${dep}'`) ||
        source.includes(`from "${dep}"`) ||
        source.includes(`from '${dep}/`) ||
        source.includes(`from "${dep}/`) ||
        source.includes(`require('${dep}')`) ||
        source.includes(`require("${dep}")`);

      expect(used, `${dep} esta em dependencies mas nao e importado pelo main`).toBe(true);
    }
  });

  it('nao deixa dependencias de build ou renderer em dependencies', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {});

    // O renderer e empacotado pelo Vite e os pins de seguranca vivem em overrides.
    const buildOrRendererOnly = [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      '@icons-pack/react-simple-icons',
      '@fontsource-variable/inter',
      'electron-builder',
      'app-builder-lib',
      'builder-util-runtime',
      'minimatch',
      'tar',
      'vitest',
      'typescript',
      'vite',
    ];

    for (const dep of buildOrRendererOnly) {
      expect(deps, `${dep} deveria estar em devDependencies`).not.toContain(dep);
    }
  });
});

describe('tamanho do pacote', () => {
  function newestAsar(): string | null {
    const candidates = ['dist', 'dist-build']
      .map((dir) => join(repoRoot, dir, 'win-unpacked', 'resources', 'app.asar'))
      .filter((asarPath) => existsSync(asarPath));

    if (candidates.length === 0) return null;

    return candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  }

  it('nao empacota a pasta data/ (backups locais)', () => {
    const config = readText('electron-builder.yml');

    expect(config).not.toMatch(/^\s*-\s*data\/\*\*\/\*\s*$/m);
  });

  it('o app.asar empacotado fica abaixo de 40 MB', () => {
    const newest = newestAsar();
    if (newest === null) {
      // Sem build local: nada a medir (o build roda no fluxo de release).
      return;
    }

    const stats = statSync(newest);

    expect(stats.size, `${newest} tem ${(stats.size / 1024 / 1024).toFixed(1)} MB`).toBeLessThan(
      40 * 1024 * 1024
    );
  });

  it('o app.asar mantem os modulos que o main process carrega', () => {
    const newest = newestAsar();
    if (newest === null) return;

    const files = asarFileList(newest);

    // `debug` e dependencia de runtime do electron-updater e usa src como main.
    // Excluir `node_modules/*/src` de forma generica derrubava o boot do app.
    expect(files).toContain('node_modules/debug/src/index.js');
    expect(files.some((file) => file.startsWith('node_modules/zod/src/'))).toBe(false);
  });
});

describe('hook afterPack', () => {
  const hook = createRequire(import.meta.url)('../../../scripts/after-pack.cjs') as AfterPackModule;

  function makeAppOutDir(files: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'fm-optimize-pack-'));
    for (const file of files) {
      writeFileSync(join(dir, file), 'conteudo');
    }
    return dir;
  }

  it('remove o dxcompiler.dll e preserva o resto do runtime', async () => {
    const appOutDir = makeAppOutDir([
      'dxcompiler.dll',
      'd3dcompiler_47.dll',
      'vk_swiftshader.dll',
      'vulkan-1.dll',
      'resources.pak',
      'fm-optimize.exe',
    ]);

    try {
      await hook({ appOutDir, electronPlatformName: 'win32' });

      expect(existsSync(join(appOutDir, 'dxcompiler.dll'))).toBe(false);
      for (const kept of [
        'd3dcompiler_47.dll',
        'vk_swiftshader.dll',
        'vulkan-1.dll',
        'resources.pak',
        'fm-optimize.exe',
      ]) {
        expect(existsSync(join(appOutDir, kept)), `${kept} nao deveria sair do pacote`).toBe(true);
      }
    } finally {
      rmSync(appOutDir, { recursive: true, force: true });
    }
  });

  it('nao quebra quando o dxcompiler.dll ja nao existe', async () => {
    const appOutDir = makeAppOutDir(['fm-optimize.exe']);

    try {
      await expect(hook({ appOutDir, electronPlatformName: 'win32' })).resolves.toBeUndefined();
      expect(existsSync(join(appOutDir, 'fm-optimize.exe'))).toBe(true);
    } finally {
      rmSync(appOutDir, { recursive: true, force: true });
    }
  });

  it('nao mexe no runtime de outras plataformas', async () => {
    const appOutDir = makeAppOutDir(['dxcompiler.dll']);

    try {
      await hook({ appOutDir, electronPlatformName: 'darwin' });
      expect(existsSync(join(appOutDir, 'dxcompiler.dll'))).toBe(true);
    } finally {
      rmSync(appOutDir, { recursive: true, force: true });
    }
  });

  it('lista somente arquivos que nao sao usados pelo renderer', () => {
    expect(hook.UNUSED_RUNTIME_FILES).toEqual(['dxcompiler.dll']);
  });
});
