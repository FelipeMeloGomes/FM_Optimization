# Refatoração P1 — relatório de alterações

Data: 26/11/2026  
Escopo: execução integral do P1 de [COMPONENTIZACAO.md](COMPONENTIZACAO.md), sem commit e sem push.  
Gate final: `bun run lint && bun run typecheck && bun run test` — verde (222 arquivos, 2481 testes).

## O que mudou

### Novos arquivos

| Arquivo                                     | Função                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `electron/shared/errors.ts`                 | `toErrorMessage`, compartilhado entre renderer e main.              |
| `electron/main/utils/json-store.ts`         | `createJsonStore` e `writeJsonAtomic`.                              |
| `electron/main/utils/powershell-json.ts`    | `parsePowerShellJson` com fallback e política de erro configurável. |
| `src/components/ui/ErrorPanel.tsx`          | Painel de erro com variantes `full`, `inline` e `card`.             |
| `src/components/hero/HeroBannerContent.tsx` | Corpo textual reutilizável do banner.                               |
| `src/components/BulkSelectionToolbar.tsx`   | Barra genérica de seleção em lote.                                  |
| `src/hooks/use-batch-apply.ts`              | Lógica de aplicação em lote extraída de `useScriptPage`.            |
| `src/hooks/use-admin-status.ts`             | Status de administrador e relançamento elevado.                     |

Cada item novo tem teste próprio: `shared-errors.test.ts`, `json-store.test.ts`, `powershell-json.test.ts`, `ErrorPanel.test.tsx`, `HeroBannerContent.test.tsx`, `BulkSelectionToolbar.test.tsx`, `use-batch-apply.test.tsx` e `use-admin-status.test.tsx`.

### 1. `toErrorMessage`

- Centralizada a normalização de `Error`, `string` e valores arbitrários em `electron/shared/errors.ts`.
- Substituídas as cópias locais em páginas e hooks do renderer e em `electron/main/services/optimization.ts` e `presentmon.ts`.
- Teste cobre `Error`, string, `null`, `undefined` e objeto comum.

### 2. `ErrorPanel`

- Componente único para estados de erro assíncronos, sempre com `role="alert"`.
- Mantidas as três variantes visuais e os textos/botões originais por meio de `retryLabel`, `retryVariant`, `retryIcon`, `messageSeparator`, `icon`, `className`, `titleClassName` e `messageClassName`.
- Migrados 15 call sites: `TweaksPage`, `DebloatPage`, `CleanerPage`, `DashboardPage`, `MeuPcPage`, `StartupPage`, `HistoryPage`, `RestorePointsPage`, `DevicePage`, `EssentialsPage`, `OptimizePcPage` e os painéis de teclado, mouse, monitor e armazenamento.
- Exportado em `src/components/ui/index.ts` junto dos tipos públicos.

### 3. `createJsonStore` / `writeJsonAtomic`

- Utilitário no main com `fallback`, `validate`, `ensureDir`, `pretty` e `onCorrupt`; a escrita continua atômica via `.tmp` + `renameSync`.
- Migrados `overlay-storage.ts` e `system-info-cache.ts`, preservando a escrita formatada do overlay e o fallback `null` do cache quando a versão difere.
- Testes cobrem arquivo ausente, JSON corrompido, validação, escrita sem resíduo `.tmp` e criação de diretório.

### 4. `parsePowerShellJson`

- Substituídos os `JSON.parse` manuais de `gpu-info.ts`, `display-settings.ts`, `mouse-settings.ts` e `keyboard-settings.ts`.
- Labels preservados nas mensagens: `configurações do monitor`, `configurações do mouse` e `configurações do teclado`.
- `gpu-info.ts` continua devolvendo `[]` em resposta vazia ou inválida (`emptyFallback` + `onInvalid`).

### 5. `HeroBannerContent`

- Implementado com `badge`, `path`, `title`, `description`, `size`, `trailing`, `titleTrailing`, `footer` e classes de título/descrição.
- Removidos os `children` duplicados em 9 páginas: `DebloatPage`, `CleanerPage`, `StartupPage`, `HistoryPage`, `DnsPage`, `EmuladoresPage`, `EssentialsPage`, `SpeedTestPage` e `OptimizePcPage`.
- Usado o wrapper onde havia conteúdo específico em 5 páginas: `DashboardPage`, `RestorePointsPage`, `SettingsPage`, `CompararPlacaPage` e `OverlayJogoPage`. Os helpers locais `PageContent` foram removidos.
- Teste verifica ícone da rota, título, descrição, tamanho `lg`, conteúdo trailing/footer e uso exclusivo de tokens do tema.

### 6. `BulkSelectionToolbar`

- Generalizada a barra de `ScriptSelectionToolbar` para qualquer tipo de item, com `getItemId`/`getItemName` e rótulos configuráveis.
- `ScriptSelectionToolbar` virou wrapper fino e manteve o contrato existente: `id="select-all-tweaks"`, contador `tabular-nums`, `role="status"` com `2 de 5`, `role="alert"` com falhas e botão “Fechar”.
- Tests cobrem seleção, contagem visível, aplicação, progresso, falhas e classes do tema (`border-border`, `bg-card`, `accent-primary`, `text-muted-foreground`).

### 7. `useAdminStatus`

- Expõe `isAdmin`, `elevating` e `relaunchAsAdmin`.
- `DebloatPage` usa o status já presente no inventário (`externalIsAdmin`) e não faz segunda chamada IPC; `OptimizePcPage` consulta `isAdmin()` com cancellation.
- O relançamento mantém `elevateApp(undefined, undefined, undefined, true)` e o toast `Não foi possível reiniciar como admin` com `duration: 'long'` e `sound` conforme as configurações.
- Testes cobrem estado pendente, falha na consulta, status externo, sucesso, falha e estado `elevating` durante a chamada.

### 8. `useBatchApply`

- Extraído de `useScriptPage` para `src/hooks/use-batch-apply.ts`.
- Preserva falhas parciais (somente os ids retornados) e marca todos os scripts como falha quando o lote rejeita.
- Cobertura direta do hook somada aos testes existentes de `useScriptPage`/`TweaksPage`.

## Melhorias

- Menos duplicação estrutural: os padrões de erro, JSON, parse de PowerShell, banner, barra de lote e elevação passaram a ter uma única implementação.
- Acessibilidade: todos os painéis de erro agora anunciam `role="alert"`; antes alguns erros eram apenas parágrafos.
- Textos e ações permaneceram idênticos ao original (inclusive “Tentar de novo” vs. “Tentar novamente” e variantes de botão).
- A remoção dos `children` dos banners diminuiu marcação manual sem alterar o visual; os casos com botão, badge ou tamanho diferente ganharam props explícitas no wrapper.
- `ScriptSelectionToolbar` deixou de duplicar 126 linhas de marcação e passou a reutilizar a barra genérica.

## Correções

- `parsePowerShellJson` não engole mais resposta vazia quando não há `emptyFallback`: agora lança a mesma mensagem de JSON inválido, com o label correto. Teste de regressão adicionado nos utilitários e nos três serviços de configuração.
- Estado de admin da `OptimizePcPage` deixou de ser atualizado após desmontagem; o hook cancela a promise com flag local.
- Regressão de `Build-ReleaseBody` (fora do P1, mas desta rodada): seções vazias não aparecem mais no corpo da release. A regra está em `scripts/release.ps1` e documentada em `AGENTS.md`, com teste em `tests/release-body.test.ts`.

## Fora do P1 (decisões registradas)

- `AdminNotice`, `useAsyncData`, `Settings*Shell`, `VirtualSpacer`, utils de formatação, `SearchInput`, `AsyncButton` e `isIntegerInRange` permanecem em P2/P3.
- Serviços com política própria não foram forcados para o utilitário genérico: `data-service.ts` (backup e normalização campo a campo), `gpu-catalog.ts` (Zod), `single-instance.ts` (objeto obrigatório), `startup-overrides.ts`, `removed-apps.ts` e `appx-inventory.ts`.
- Contextos especiais de admin (Cleaner, Startup, Restore Points, AutoClean), `adminRequired` e `ElevatedLaunchResult` ficaram de fora de `useAdminStatus`.
- A regra de corpo de release não foi movida para `docs/COMPONENTIZACAO.md`; ela continua implementada no script e descrita em `AGENTS.md`.
- `DebloatPage` manteve o estado vazio manual e os painéis de admin específicos; a migração para `EmptyState`/`AdminNotice` depende do P2.

## Verificação

```powershell
bun run lint       # 509 arquivos, sem erros
bun run typecheck  # node + web, sem erros
bun run test       # 222 arquivos / 2481 testes, todos passando
```

Nenhum commit ou push foi feito nesta rodada.
