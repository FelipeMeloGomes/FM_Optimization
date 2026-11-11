import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O `biome.json` listava os arquivos markdown em `files.includes`, mas o Biome
 * 2.5.x nao tinha suporte a markdown: os arquivos eram ignorados em silencio e
 * o `check` respondia "No files were processed". Estes testes travam o suporte
 * ligado de verdade — rodam o binario do Biome sobre um markdown real, em vez de
 * apenas conferir se a chave existe no JSON.
 */

const repoRoot = process.cwd();
const biomeBin = join(repoRoot, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
const probeFile = 'biome-markdown-probe.md';
const probePath = join(repoRoot, probeFile);

type BiomeConfig = {
  $schema?: string;
  files?: { includes?: string[] };
  markdown?: {
    formatter?: { enabled?: boolean };
    linter?: { enabled?: boolean };
  };
};

function readBiomeConfig(): BiomeConfig {
  return JSON.parse(readFileSync(join(repoRoot, 'biome.json'), 'utf8')) as BiomeConfig;
}

function runBiomeCheck(file: string): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [biomeBin, 'check', file], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

describe('configuracao do Biome para markdown', () => {
  it('mantem o $schema alinhado com a versao instalada', () => {
    const { version } = JSON.parse(
      readFileSync(join(repoRoot, 'node_modules', '@biomejs', 'biome', 'package.json'), 'utf8')
    ) as { version: string };

    // Schema divergente nao e cosmetico: o CLI emite erro "deserialize" e falha o lint.
    expect(readBiomeConfig().$schema).toBe(`https://biomejs.dev/schemas/${version}/schema.json`);
  });

  it('inclui arquivos markdown e habilita formatador e linter', () => {
    const config = readBiomeConfig();

    expect(config.files?.includes).toContain('**/*.md');
    expect(config.markdown?.formatter?.enabled).toBe(true);
    expect(config.markdown?.linter?.enabled).toBe(true);
  });

  it('rejeita markdown com tabela desalinhada', () => {
    try {
      writeFileSync(probePath, '# Titulo\n\n|a|b|\n|-|-|\n|1|2|\n', 'utf8');

      const result = runBiomeCheck(probeFile);

      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('format');
    } finally {
      rmSync(probePath, { force: true });
    }
  });

  it('aceita markdown ja formatado', () => {
    try {
      writeFileSync(probePath, '# Titulo\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n', 'utf8');

      const result = runBiomeCheck(probeFile);

      expect(result.status, result.output).toBe(0);
    } finally {
      rmSync(probePath, { force: true });
    }
  });
});
