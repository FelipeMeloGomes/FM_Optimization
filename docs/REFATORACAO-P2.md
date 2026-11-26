# Refatoração P2 — relatório de alterações

Data: 26/11/2026  
Escopo: execução integral do P2 de [COMPONENTIZACAO.md](COMPONENTIZACAO.md), na branch `refactor/p2-componentizacao`, a partir de `6aef0e9`.  
Plano: [2026-11-26-p2-componentizacao.md](superpowers/plans/2026-11-26-p2-componentizacao.md).  
Gate final: `bun run lint && bun run typecheck && bun run test` — verde (510 arquivos no Biome, typecheck node + web, 230 arquivos / 2561 testes).

## O que mudou

### Novos arquivos

| Arquivo                                            | Função                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/ui/AdminNotice.tsx`                | Aviso inline de administrador, com mensagem rica e botão opcional.     |
| `src/hooks/use-latest-request.ts`                  | Guarda de requisição mais recente com `next`/`isCurrent`/`invalidate`. |
| `src/hooks/use-async-data.ts`                      | Carregamento assíncrono com `AsyncState`, cancelamento e `setData`.    |
| `src/components/settings/SettingsSectionShell.tsx` | Cabeçalho e corpo das seções de Configurações.                         |
| `src/components/settings/SettingsPanelShell.tsx`   | Card dos painéis de Ajustes do Windows.                                |
| `src/components/settings/SettingsApplyFooter.tsx`  | Rodapé de aplicar, descartar, defaults e resultado.                    |
| `src/components/VirtualSpacer.tsx`                 | Espaçadores de lista e de tabela para listas virtualizadas.            |

Cada item novo tem teste próprio: `AdminNotice.test.tsx`, `use-latest-request.test.tsx`, `use-async-data.test.tsx`, `SettingsSectionShell.test.tsx`, `SettingsPanelShell.test.tsx`, `SettingsApplyFooter.test.tsx`, `VirtualSpacer.test.tsx` e `NotificationsSection.test.tsx`. Os testes de `format.test.ts` foram estendidos com 9 casos.

### 1. `AdminNotice`

- API `message`, `onRelaunch?`, `relaunching?`, `compact?`, `icon?` e `relaunchVariant?`; componente burro, sem interpretar o retorno do callback.
- Wrapper com `border-warning/20 bg-warning/5`, ícone padrão `ShieldAlert` com `aria-hidden` e botão **Reiniciar como admin** ausente quando não há callback.
- Exportado em `src/components/ui/index.ts` e migrado em quatro avisos inline: `CleanerPage`, `OptimizePcPage`, `DebloatPage` e `StartupPage`. Textos, ícones customizados (`Lock`), `compact` e estados de desabilitação foram preservados.

### 2. `useLatestRequest` / `useAsyncData`

- `useLatestRequest` chegou primeiro como guarda de concorrência; `useAsyncData` usa `toErrorMessage` e `AsyncState` já existentes, sem alterar contratos públicos.
- `reload` entra em `loading` sincronamente, o loader roda fora do caminho síncrono e somente a requisição mais recente escreve estado ou dispara `onSuccess`.
- `setData` só atualiza quando o estado é `success`, evitando resurrect de dados antes do primeiro carregamento.
- Migrados `useStartup`, `useEssentials` e `ScriptContext` para `useAsyncData`; `useAppxInventory`, `useCleanerItems`, `RestorePointContext` e `AutoCleanContext` receberam apenas as guardas de `useLatestRequest`, preservando cache, inventário anterior e dedupe próprios.

### 3. `SettingsSectionShell`

- API `title`, `tone`, `variant` (`rows`/`panel`) e `children`; tons `primary`, `warning`, `info` e `success` usam tokens do tema, sem cor fixa.
- Seis seções migradas sem mudar texto, ordem, `role="status"`/`role="alert"` nem o botão **Tentar novamente**: Tema, Preferências, Notificações, Dados, Bloqueio de Páginas e Atualizações.
- `SettingsPage.test.tsx` confirma os seis títulos e o único `max-w-lg`. `NotificationsSection.test.tsx` foi validado por mutação antes de ser aceito como teste de caracterização.

### 4. `SettingsPanelShell` / `SettingsApplyFooter`

- `SettingsPanelShell` centraliza título padrão **Ajustes do Windows**, badge, `note`, espaçamento (`gap-4`/`gap-5`) e tokens do tema; o rodapé visual continua em `SettingsPreviewLayout`.
- `SettingsApplyFooter` concentra **Aplicar**, **Restaurar padrão**, **Cancelar alterações**, **Preencher com padrões**, confirmação (`appliedAt`, `applied`, `appliedLabel`, `appliedInline`) e erro via `ErrorPanel variant="inline"`.
- Quatro painéis migrados: teclado e mouse com `tempo real`, quatro botões e `appliedAt`; monitor com `Por monitor`, dois botões e título `Não foi possível aplicar`; storage com `Por disco`, ações de disco e `Concluído` inline. `onRestoreDefault` continua aplicando defaults; `onFillDefaults` só preenche o draft.

### 5. `VirtualSpacer` / `VirtualTableSpacer`

- `VirtualSpacer` preserva `data-testid`, `aria-hidden="true"` e o estilo exato de altura; `VirtualTableSpacer` gera `<tr style>` com `<td colSpan>`, sem classes de `TableRow`/`TableCell` e sem `data-testid`.
- Oito call sites migrados: `VirtualizedScriptList`, `DebloatPage` e `CleanerPage` (spacers de div) e `HistoryPage`/`StartupPage` (spacers de tabela, colSpan 4 e 5).
- Os guards `paddingTop > 0` e `paddingBottom > 0` foram mantidos, então altura zero continua ausente do DOM.

### 6. Utils de formatação

- Acrescentados `formatDateTime`, `plural`, `formatUptimeCompact`, `formatUptimeLong` e `formatElapsedMs` sem tocar no `formatDuration` existente (segundos com prefixo `~`).
- `formatDate` local de `HistoryPage`/`RestorePointsPage`, `plural` local de `DebloatPage` e ternários de `ConfirmBulkScriptDialog`, `ConfirmRemoveAppsDialog`, `CommandPalette` e `MeuPcPage` passaram a usar os utils.
- `DashboardPage` usa `formatUptimeCompact` (`1d 1h 1m`); `MeuPcPage` usa `formatUptimeLong` (`1 d 1 h 1 min 1 s`) e `plural` para unidades. `HistoryPage` usa `formatElapsedMs` (`1s`, `1m 30s`), sem o `~` de `formatDuration`.

## Melhorias

- Padrões repetidos de aviso de admin, carregamento assíncrono, seção de configurações, rodapé de ajustes, espaçador virtual e formatação passaram a ter uma única implementação.
- Testes novos cobrem comportamento visível (texto, callbacks, desabilitação, `role`, classes de tema) e casos de fronteira dos utils (0, 1, >1, dias/horas/minutos/segundos e milissegundos).
- Acessibilidade preservada ou reforçada: ícones decorativos com `aria-hidden`, `role="alert"`/`role="status"` mantidos e contagem de resultados anunciada por `plural`.
- Toda a extração foi feita com ciclo RED→GREEN; o gate completo foi rodado após cada task.

## Correções

- `OptimizePcPage` voltou a importar `Lock`: o ícone customizado do aviso migrado continuava usando o componente, e o teste da página reproduziu o `ReferenceError` antes da correção.
- Nenhuma mudança de comportamento voltada ao usuário final foi introduzida; textos, ordem de elementos e estados de carga/erro foram preservados pelos testes de caracterização.

## Fora do P2 (decisões registradas)

- P3 continua intacto: `SearchInput`, `AsyncButton`, `isIntegerInRange`, painel “Limpezas pendentes” de `CleanerPage`, pendências de `AutoCleanModal` e painel completo de `RestorePointsPage`.
- `SettingsPreviewLayout` continua responsável pelo rodapé visual; `SettingsPanelShell` não engole `footer`.
- `ConfirmDialog.formatElapsed` e `formatInstallDate` de `MeuPcPage` não foram unificados: o primeiro tem saídas próprias travadas por teste e o segundo usa WMI com `timeZone: 'UTC'`.
- `biome.json` passou a ignorar `**/.superpowers`, onde ficam briefs e ledgers gitignored do harness; isso evita que arquivos temporários entrem no gate.
- Commit feito em `refactor/p2-componentizacao`, sem push.

## Verificação

```powershell
bun run lint       # 510 arquivos, sem erros
bun run typecheck  # node + web, sem erros
bun run test       # 230 arquivos / 2561 testes, todos passando
```
