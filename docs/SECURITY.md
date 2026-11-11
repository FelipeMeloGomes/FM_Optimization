# Segurança — FM Optimize

O app roda comando PowerShell no sistema do usuário. O IPC (fronteira entre renderer e main) é a superfície de confiança principal e recebe defesa em profundidade.

## Fronteira de confiança

O renderer é tratado como **não confiável**. Todo dado que entra no main process via IPC é validado antes de tocar o sistema.

```
renderer ──IPC──> [rate-limit] ──> [validação Zod] ──> handler ──> PowerShell
```

## Controles implementados

### 1. Sanitização de PowerShell (`services/powershell.ts`)

- `psEscape(arg)` escapa caracteres perigosos: `"` `` ` `` `$` `'` `;` `(` `)` `|` `&` `<` `>`.
- `execPowerShellSafe(command, ...args)` monta comandos com argumentos parametrizados e escapados — nunca interpola string do usuário no corpo do script.
- `execPowerShell(script)` (usado só para scripts internos conhecidos) passa por `sanitizeScript()` que bloqueia padrões perigosos.

### 2. Rate-limit (`services/rate-limit.ts`)

Janela deslizante por canal para evitar abuso/starvation do main process:

- `benchmark-dns`: 3 req / 5s
- `apply-dns`: 5 req / 3s
- `elevate-app`: 2 req / 10s
- `restore-*`, `execute-script`: limites específicos
- Canais genéricos: 20 req / 1s

### 3. Validação de entrada (Zod)

`validateIpcInput(channel, input)` valida contra `IpcSchemas`. Canais críticos:

- `execute-script` / `extract-script` / `get-script-content`: `ScriptIdSchema` (regex alfanumérico + `_-`, 1–100 chars)
- `apply-dns`: `InterfaceIndexSchema` + `DnsAddressesSchema` (IPv4 validado por regex)
- `elevate-app`: `scriptId` opcional validado como `ScriptIdSchema`

### 4. Allowlist de elevação

- `elevate-app` valida `scriptId` contra a lista de scripts conhecidos (`loadScripts()`).
- Ao reiniciar elevado (`--elevate-script` / `--elevate-dns`), `main/index.ts` **revalida** o `scriptId` e os endereços DNS com `DnsAddressesSchema` — fecha a brecha de um atacante lançar o exe elevado com argumentos forjados.

### 5. Tipos branded (`branded-types.ts`)

IDs de domínio (`ScriptId`, `InterfaceIndex`, `RestorePointSeq`) são _branded types_. O compilador impede que uma `string`/`number` qualquer seja passada onde um ID tipado é esperado — estados inválidos se tornam não representáveis.

## Modelo de ameaça (resumo)

| Ameaça                         | Mitigação                             |
| ------------------------------ | ------------------------------------- |
| Injeção de comando via IPC     | `psEscape` + args parametrizados      |
| Loop/abuso de handlers         | Rate-limit por canal                  |
| Script arbitrário elevado      | Allowlist de `scriptId` + revalidação |
| IPv4 malformado                | `DnsAddressesSchema` (regex)          |
| Argumento forjado pós-elevação | Revalidação em `handleElevatedScript` |

## Testes

A suíte Vitest (`electron/main/**/*.test.ts`) cobre rate-limit, `psEscape`, branded types e `validateIpcInput`. Rodar com `npm test`.
