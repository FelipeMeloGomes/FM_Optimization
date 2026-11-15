$ErrorActionPreference = "Stop"

# ─── Validações iniciais ───
if (-not (Test-Path ".env.local")) {
  throw ".env.local não encontrado."
}
if (-not (Test-Path ".git")) {
  throw "Diretório não é um repositório git"
}

$status = git status --porcelain
if ($status) {
  throw "Working tree sujo."
}

# ─── Bump de versão (patch) ───
Write-Output "`n=== Release: patch build ===`n"
Write-Output "Executando npm version patch...`n"
npm version patch
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
  throw "latest.yml não contém a versão $version"
}
Write-Output "  Versão confirmada: $version`n"

# ─── Corpo da release ───
$body = @"
## $tag - $(Get-Date -Format 'dd/MM/yyyy')

### Correções
- Tabela da página de Pontos de Restauração: removida virtualização quebrada que causava layout incorreto. A tabela agora usa scrolling nativo responsivo.
"@

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
  $refApi = "https://api.github.com/repos/FelipeMeloGomes/FM_Optimization/git/refs/tags/$tag"
  try { Invoke-RestMethod -Uri $refApi -Method Delete -Headers @{ Authorization = "Bearer $env:GITHUB_TOKEN" } } catch { }
} catch { }

$release = Invoke-RestMethod -Uri $api -Method Post -Headers @{
  Authorization = "Bearer $env:GITHUB_TOKEN"
  "Content-Type" = "application/json"
} -Body (@{
  tag_name = $tag
  name = $tag
  body = $body
} | ConvertTo-Json)

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