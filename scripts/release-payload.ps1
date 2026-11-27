param(
  [Parameter(Mandatory = $true)] [string] $Tag,
  [Parameter(Mandatory = $true)] [string] $Body
)

$json = @{
  tag_name = $Tag
  name = $Tag
  body = $Body
} | ConvertTo-Json

# O Windows PowerShell 5.1 codifica bodies de string em ANSI (codepage 1252),
# o que gera JSON invalido para a API do GitHub quando ha acentos. Enviar bytes
# UTF-8 explicitamente evita o erro 400 "Problems parsing JSON".
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
