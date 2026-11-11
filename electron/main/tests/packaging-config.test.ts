import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
  it('nao empacota a pasta data/ (backups locais)', () => {
    const config = readText('electron-builder.yml');

    expect(config).not.toMatch(/^\s*-\s*data\/\*\*\/\*\s*$/m);
  });

  it('o app.asar empacotado fica abaixo de 40 MB', () => {
    const candidates = ['dist', 'dist-build']
      .map((dir) => join(repoRoot, dir, 'win-unpacked', 'resources', 'app.asar'))
      .filter((asarPath) => existsSync(asarPath));

    if (candidates.length === 0) {
      // Sem build local: nada a medir (o build roda no fluxo de release).
      return;
    }

    const newest = candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    const stats = statSync(newest);

    expect(stats.size, `${newest} tem ${(stats.size / 1024 / 1024).toFixed(1)} MB`).toBeLessThan(
      40 * 1024 * 1024
    );
  });
});
