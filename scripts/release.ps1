$ErrorActionPreference = "Stop"

function Build-ReleaseBody {
  param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [Parameter(Mandatory = $true)][string]$Date,
    [string]$Novidades,
    [string]$Melhorias,
    [string]$Correcoes,
    [string]$Tecnico
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("## $Tag - $Date")

  $sections = @(
    @{ Title = 'Novidades'; Text = $Novidades },
    @{ Title = 'Melhorias'; Text = $Melhorias },
    @{ Title = 'Correções'; Text = $Correcoes },
    @{ Title = 'Técnico'; Text = $Tecnico }
  )

  foreach ($section in $sections) {
    if (-not $section.Text) { continue }

    $items = @(
      $section.Text -split '\r?\n' |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and $_ -ne '-' }
    )
    if ($items.Count -eq 0) { continue }

    $lines.Add('')
    $lines.Add("### $($section.Title)")
    $lines.Add('')
    foreach ($item in $items) {
      if ($item -match '^[-*] ') {
        $lines.Add($item)
      } else {
        $lines.Add("- $item")
      }
    }
  }

  return (($lines -join [string][char]10).TrimEnd()) + [string][char]10
}

# ─── Validações iniciais ───

if (-not (Test-Path ".env.local")) {
  throw ".env.local não encontrado. Crie com GITHUB_TOKEN=<token fine-grained github_pat_...> (classic ghp_ também funciona)"
}
if (-not (Test-Path ".git")) {
  throw "Diretório não é um repositório git"
}

$status = git status --porcelain
if ($status) {
  throw "Working tree sujo. Faça commit ou stash das mudanças antes de release."
}

# ─── Bump de versão ───

Write-Output "`n=== Release: novo build ===`n"

do {
  $bump = Read-Host "Tipo de bump (patch/minor/major)"
} while ($bump -notin @("patch", "minor", "major"))

Write-Output "Executando npm version $bump...`n"
npm version $bump
if ($LASTEXITCODE -ne 0) { throw "npm version falhou" }

$version = node -p "require('./package.json').version"
$tag = "v$version"
Write-Output "Versão: $version`n"

# ─── Build ───

Write-Output "=== Compilando TypeScript... ==="
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }

Write-Output "`n=== Gerando builds Windows... ==="
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { throw "electron-builder falhou" }

# ─── Verificação de assets ───

Write-Output "`n=== Verificando assets... ==="
$expected = @(
  "dist/fm-optimize-setup.exe"
  "dist/fm-optimize-setup.exe.blockmap"
  "dist/latest.yml"
)
foreach ($a in $expected) {
  if (-not (Test-Path $a)) {
    throw "Asset faltando: $a"
  }
  Write-Output "  OK: $a"
}

$ymlVersion = Select-String -Path "dist/latest.yml" -Pattern "^version: $version$" -Quiet
if (-not $ymlVersion) {
  throw "latest.yml não contém a versão $version (pode ter sido buildado com versão antiga)"
}
Write-Output "  Versão confirmada: $version`n"

# ─── Corpo da release ───

Write-Output "=== Corpo da release ==="
Write-Output "Deixe em branco e pressione Enter para pular uma seção.`n"

$novidades = Read-Host "Novidades"
$melhorias = Read-Host "Melhorias"
$correcoes = Read-Host "Correções"
$tecnico = Read-Host "Técnico (opcional)"

$body = Build-ReleaseBody -Tag $tag -Date (Get-Date -Format 'dd/MM/yyyy') `
  -Novidades $novidades -Melhorias $melhorias `
  -Correcoes $correcoes -Tecnico $tecnico

# ─── Push ───

Write-Output "`n=== Fazendo push para GitHub... ==="
git push --follow-tags
if ($LASTEXITCODE -ne 0) { throw "git push falhou" }

# ─── Release no GitHub ───

Write-Output "`n=== Criando release no GitHub... ==="
$env:GITHUB_TOKEN = (Get-Content -Path ".env.local" | ForEach-Object {
  if ($_ -match '^GITHUB_TOKEN=(.*)') { $matches[1] }
})

$api = "https://api.github.com/repos/FelipeMeloGomes/FM_Optimization/releases"

# Deleta release existente com a mesma tag (se houver)
try {
  $existing = Invoke-RestMethod -Uri "$api/tags/$tag" -Headers @{
    Authorization = "Bearer $env:GITHUB_TOKEN"
  }
  Write-Output "Release $tag já existe, recriando..."
  Invoke-RestMethod -Uri "$api/$($existing.id)" -Method Delete -Headers @{
    Authorization = "Bearer $env:GITHUB_TOKEN"
  }
  # Deleta a tag remota também
  $refApi = "https://api.github.com/repos/FelipeMeloGomes/FM_Optimization/git/refs/tags/$tag"
  try {
    Invoke-RestMethod -Uri $refApi -Method Delete -Headers @{
      Authorization = "Bearer $env:GITHUB_TOKEN"
    }
  } catch { }
} catch { }

$release = Invoke-RestMethod -Uri $api -Method Post -Headers @{
  Authorization = "Bearer $env:GITHUB_TOKEN"
} -Body (@{
  tag_name = $tag
  name = $tag
  body = $body
} | ConvertTo-Json) -ContentType "application/json"

$uploadUrl = ($release.upload_url -replace '\{.*\}', '')

$assets = @(
  @{Path="dist/fm-optimize-setup.exe"; Type="application/x-msdownload"}
  @{Path="dist/fm-optimize-setup.exe.blockmap"; Type="application/octet-stream"}
  @{Path="dist/latest.yml"; Type="application/octet-stream"}
)

Write-Output "`n=== Uploading assets... ==="
foreach ($a in $assets) {
  $name = Split-Path $a.Path -Leaf
  Write-Output "  Uploading $name..."
  Invoke-RestMethod -Uri "${uploadUrl}?name=$name" -Method Post -Headers @{
    Authorization = "Bearer $env:GITHUB_TOKEN"
    "Content-Type" = $a.Type
  } -InFile $a.Path
  Write-Output "  OK"
}

Write-Output "`n=== Release $tag criada com sucesso! ==="
