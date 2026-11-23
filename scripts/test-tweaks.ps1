<#
.SYNOPSIS
  Testa um tweak do plano dentro do Windows Sandbox, sem tocar no Windows real.

.DESCRIPTION
  1. Extrai o script e as verificações derivadas dele do scripts.json real.
  2. Monta um .wsb com a entrada somente-leitura e uma saída gravável.
  3. Roda o tweak no Sandbox, mostrando ANTES/DEPOIS de cada chave e o veredito.
  4. Ao fechar o Sandbox, imprime o relatório. Nada do tweak vaza para o host.

  Pré-requisito: Windows Sandbox habilitado (requer reboot uma vez):
    dism /Online /Enable-Feature /FeatureName:WindowsSandbox /All

.EXAMPLE
  .\scripts\test-tweaks.ps1 -Id tweaks-1
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Id,
  [switch]$KeepOutput
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sandboxExe = Join-Path $env:WINDIR 'System32\WindowsSandbox.exe'

if (-not (Test-Path $sandboxExe)) {
  Write-Error "Windows Sandbox não está habilitado. Rode como admin: dism /Online /Enable-Feature /FeatureName:WindowsSandbox /All"
}

$work = Join-Path $env:TEMP "fm-optimize-sandbox-$Id"
$inDir = Join-Path $work 'fm-optimize-in'
$outDir = Join-Path $work 'fm-optimize-out'
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $inDir, $outDir | Out-Null

# Usa os serviços reais do app para extrair o script e as verificações:
# nada de catálogo transcrito à mão.
$exporter = Join-Path $work 'export-checks.mjs'
@"
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.argv[2].replaceAll('\\\\', '/');
const id = process.argv[3];
const dir = process.argv[4];
const checks = await import(\`file:///\${root}/electron/main/services/optimization-checks.ts\`);
const scripts = JSON.parse(readFileSync(\`\${root}/resources/scripts.json\`, 'utf8'));
const script = scripts.find((entry) => entry.id === id);
if (!script) throw new Error(\`Script não encontrado: \${id}\`);
const extension = script.extension === 'reg' ? 'reg' : 'bat';
writeFileSync(\`\${dir}/script.\${extension}\`, Buffer.from(script.content, 'base64'));
writeFileSync(\`\${dir}/checks.json\`, JSON.stringify({
  id: script.id,
  name: script.name,
  extension,
  checks: checks.parseChecks(script),
  powerQueries: checks.POWER_QUERIES,
  tcpLabels: checks.TCP_LABELS,
}, null, 2));
console.log(script.name);
"@ | Set-Content -Path $exporter -Encoding utf8

$name = & bun $exporter $root $Id $inDir
if ($LASTEXITCODE -ne 0) { throw 'Falha ao extrair o tweak do catálogo.' }
Write-Host "Tweak: $name ($Id)" -ForegroundColor Cyan

$runner = Join-Path $inDir 'run.ps1'
@'
$ErrorActionPreference = 'Continue'
$in = 'C:\Users\WDAGUtilityAccount\Desktop\fm-optimize-in'
$out = 'C:\Users\WDAGUtilityAccount\Desktop\fm-optimize-out'
$manifest = Get-Content (Join-Path $in 'checks.json') -Raw | ConvertFrom-Json
$log = Join-Path $out 'result.log'
$lines = [System.Collections.Generic.List[string]]::new()

function Normalize([string]$type, [string]$value) {
  if ($type -eq 'REG_DWORD' -or $type -eq 'REG_QWORD') {
    if ($value -match '^0x([0-9a-f]+)$') { return [Convert]::ToInt64($matches[1], 16).ToString() }
    return $value.Trim()
  }
  if ($type -eq 'REG_BINARY') { return ($value -replace '[\\,\s]', '').ToUpperInvariant() }
  return $value.Trim().Trim('"').ToLowerInvariant()
}

function Query([object]$check) {
  if ($check.kind -eq 'registry') {
    $raw = & reg.exe query $check.key /v $check.value 2>&1 | Out-String
    $line = ($raw -split "`r?`n" | Where-Object { $_ -match "(?i)$([regex]::Escape($check.value))\s+REG_" } | Select-Object -First 1)
    if (-not $line) { return '<ausente>' }
    $parts = $line -split '\s{2,}'
    if ($parts.Count -lt 3) { return '<indefinido>' }
    return Normalize $parts[1] $parts[2]
  }
  if ($check.kind -eq 'tcp') {
    $raw = & netsh.exe int tcp show global 2>&1 | Out-String
    $label = $manifest.tcpLabels.($check.setting)
    if (-not $label) { return '<sem rótulo>' }
    $line = ($raw -split "`r?`n" | Where-Object { $_ -match "(?i)^\s*$([regex]::Escape($label))\s*:" } | Select-Object -First 1)
    if (-not $line) { return '<ausente>' }
    $value = ($line -split ':', 2)[1].Trim().ToLowerInvariant()
    if ($value -eq 'enable') { $value = 'enabled' }
    if ($value -eq 'disable') { $value = 'disabled' }
    return $value
  }
  $setting = $check.setting
  $query = $manifest.powerQueries.PSObject.Properties[$setting].Value
  if (-not $query) { return '<sem consulta>' }
  $raw = & powercfg.exe @($query.args) 2>&1 | Out-String
  $field = if ($query.field -eq 'dc') { 'DC' } else { 'AC' }
  $match = [regex]::Match($raw, "Current $field Power Setting Index:\s*(0x[0-9a-f]+)", 'IgnoreCase')
  if (-not $match.Success) { return '<ausente>' }
  return Normalize 'REG_DWORD' $match.Groups[1].Value
}

function Snapshot([string]$phase) {
  $lines.Add("--- $phase ---")
  foreach ($check in $manifest.checks) {
    $id = if ($check.kind -eq 'registry') { "registry:$($check.key)|$($check.value)" } else { "$($check.kind):$($check.setting)" }
    $lines.Add("$id | esperado=$($check.expected) | atual=$(Query $check)")
  }
}

Snapshot 'ANTES'
$scriptFile = Join-Path $in "script.$($manifest.extension)"
if ($manifest.extension -eq 'reg') {
  & reg.exe import $scriptFile 2>&1 | ForEach-Object { $lines.Add("exec: $_") }
} else {
  '' | & cmd.exe /c "`"$scriptFile`"" 2>&1 | ForEach-Object { $lines.Add("exec: $_") }
}
Snapshot 'DEPOIS'

$lines.Add('--- VEREDITO ---')
$pendentes = 0
foreach ($check in $manifest.checks) {
  $id = if ($check.kind -eq 'registry') { "registry:$($check.key)|$($check.value)" } else { "$($check.kind):$($check.setting)" }
  $antes = $lines | Where-Object { $_ -like "$id | esperado=* | atual=*" } | Select-Object -First 1
  $depois = $lines | Where-Object { $_ -like "$id | esperado=* | atual=*" } | Select-Object -Last 1
  $valor = ($depois -split '\| atual=', 2)[1]
  if ($valor -eq $check.expected) {
    $lines.Add("OK   $id")
  } else {
    $lines.Add("FALHA $id (antes: $(($antes -split '\| atual=', 2)[1]} | depois: $valor)")
    $pendentes++
  }
}
$lines.Add("Resumo: $($manifest.checks.Count - $pendentes)/$($manifest.checks.Count) verificações bateram")
$lines | Set-Content -Path $log -Encoding utf8
Write-Host "Resultado em $log"
'@ | Set-Content -Path $runner -Encoding utf8

$wsb = Join-Path $work 'sandbox.wsb'
@"
<Configuration>
  <MappedFolder><HostFolder>$inDir</HostFolder><ReadOnly>true</ReadOnly></MappedFolder>
  <MappedFolder><HostFolder>$outDir</HostFolder><ReadOnly>false</ReadOnly></MappedFolder>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\WDAGUtilityAccount\Desktop\fm-optimize-in\run.ps1"</Command>
  </LogonCommand>
</Configuration>
"@ | Set-Content -Path $wsb -Encoding utf8

Write-Host 'Abrindo o Windows Sandbox... Feche a janela do Sandbox quando o teste terminar.' -ForegroundColor Yellow
& $sandboxExe $wsb

$log = Join-Path $outDir 'result.log'
$deadline = (Get-Date).AddMinutes(10)
while (-not (Test-Path $log) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
}

if (Test-Path $log) {
  Get-Content -Path $log | ForEach-Object { Write-Host $_ }
} else {
  Write-Warning 'Nenhum resultado encontrado. O Sandbox pode ter sido fechado antes do script terminar.'
}
Write-Host "Arquivos de trabalho: $work"
if (-not $KeepOutput) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
