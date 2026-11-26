import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const releaseScript = join(repoRoot, 'scripts', 'release.ps1');

interface BodyCase {
  name: string;
  tag: string;
  date: string;
  novidades: string;
  melhorias: string;
  correcoes: string;
  tecnico: string;
}

interface BodyResult {
  name: string;
  body: string;
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function psValue(value: string): string {
  if (!value.includes('\n')) return psQuote(value);
  const parts = value.split('\n').map(psQuote);
  return `@(${parts.join(',')}) -join [string][char]10`;
}

function buildReleaseBodies(cases: BodyCase[]): BodyResult[] {
  const caseLiterals = cases
    .map(
      (item) =>
        `@{ name=${psQuote(item.name)}; tag=${psQuote(item.tag)}; date=${psQuote(item.date)}; ` +
        `novidades=${psValue(item.novidades)}; melhorias=${psValue(item.melhorias)}; ` +
        `correcoes=${psValue(item.correcoes)}; tecnico=${psValue(item.tecnico)} }`
    )
    .join(', ');

  const harness = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$tokens = $null
$errors = $null
$source = [System.IO.File]::ReadAllText(${psQuote(releaseScript)}, [System.Text.Encoding]::UTF8)
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | ForEach-Object { $_.Message } | Out-String) }
$fn = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Build-ReleaseBody'
}, $true)
if (-not $fn) { throw 'Build-ReleaseBody not found in scripts/release.ps1' }
. ([scriptblock]::Create($fn.Extent.Text))
$cases = @(${caseLiterals})
$output = @()
foreach ($case in $cases) {
  $body = Build-ReleaseBody -Tag $case.tag -Date $case.date -Novidades $case.novidades -Melhorias $case.melhorias -Correcoes $case.correcoes -Tecnico $case.tecnico
  $output += [pscustomobject]@{ name = $case.name; body = $body }
}
@($output) | ConvertTo-Json -Depth 5 -Compress
`;

  // -EncodedCommand usa UTF-16LE e evita o ANSI do Windows PowerShell 5.1 em .ps1 sem BOM.
  const encoded = Buffer.from(harness, 'utf16le').toString('base64');
  const stdout = execFileSync(
    process.env.WINDIR
      ? join(process.env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const parsed = JSON.parse(stdout.trim()) as BodyResult | BodyResult[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function bodyFor(overrides: Partial<BodyCase> = {}): string {
  const base: BodyCase = {
    name: 'case',
    tag: 'v9.9.9',
    date: '26/11/2026',
    novidades: '',
    melhorias: '',
    correcoes: '',
    tecnico: '',
    ...overrides,
  };
  const [result] = buildReleaseBodies([base]);
  return result.body;
}

describe('Build-ReleaseBody (corpo da release)', () => {
  it('omite secoes vazias', () => {
    const body = bodyFor({ novidades: 'Primeira mudanca' });

    expect(body).toBe('## v9.9.9 - 26/11/2026\n\n### Novidades\n\n- Primeira mudanca\n');
  });

  it('emite apenas o titulo quando todas as secoes estao vazias', () => {
    expect(bodyFor()).toBe('## v9.9.9 - 26/11/2026\n');
  });

  it('descarta placeholder de traco e linhas em branco', () => {
    const body = bodyFor({ novidades: '-   \n\nSegunda linha  \n- ' });

    expect(body).toContain('- Segunda linha');
    expect(body).not.toContain('-\n-');
    expect(body).not.toContain('- -');
  });

  it('adiciona marcador apenas nas linhas que nao sao item', () => {
    const body = bodyFor({ novidades: 'linha A\n- linha B' });

    expect(body).toContain('- linha A');
    expect(body).not.toContain('- - linha B');
  });

  it('mantem a ordem Novidades, Melhorias, Correcoes e Tecnico', () => {
    const body = bodyFor({
      novidades: 'N',
      melhorias: 'M',
      correcoes: 'C',
      tecnico: 'T',
    });

    const sections = ['Novidades', 'Melhorias', 'Correções', 'Técnico'];
    const positions = sections.map((name) => body.indexOf(`### ${name}`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
