# P2 de componentização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar integralmente o P2 de `docs/COMPONENTIZACAO.md`: `AdminNotice`, `useAsyncData`/`useLatestRequest`, `SettingsSectionShell`, `SettingsPanelShell`/`SettingsApplyFooter`, `VirtualSpacer`/`VirtualTableSpacer` e utils de formatação.

**Architecture:** Extrair padrões já existentes para componentes/hooks/utils compartilhados, preservando textos, variantes, tokens do tema, contratos públicos e testes atuais. Nenhuma mudança de bridge/IPC.

**Tech Stack:** Electron + React 19 + TypeScript, Tailwind CSS 4, Vitest + Testing Library, Biome, bun.

**Spec:** `docs/COMPONENTIZACAO.md` (§2 prioridades, §3.9–3.13 e 3.16, §5 ordem sugerida).

**Branch de trabalho:** `refactor/p2-componentizacao`, criada a partir de `refactor/p1-componentizacao` (HEAD `6aef0e9`). Sem push nesta rodada.

## Global Constraints

- Cada item novo segue RED→GREEN: escrever o teste, confirmar que falha, implementar, confirmar que passa.
- Todo comportamento visível ao usuário é preservado: textos exatos, rótulos, `role`s, desabilitação de botões e ordem de ações.
- Tokens semânticos do tema (`bg-primary`, `text-primary`, `bg-background`, `border-border`, `text-muted-foreground`, `bg-success`, `bg-warning`, `bg-info`, `text-destructive`); proibidas cores fixas. Classes dinâmicas como `bg-${tone}` não são vistas pelo Tailwind — usar mapas estáticos.
- Nenhum item de P3 (`SearchInput`, `AsyncButton`, `isIntegerInRange`) entra neste plano.
- Gate antes de cada commit: `bun run lint && bun run typecheck && bun run test`.
- `README.md`/documentação só são atualizados se houver mudança visível ou funcional relevante.
- Nunca commitar `.env.local` (já ignorado).

## Tasks

### Task 1 — `AdminNotice`

- [ ] **RED:** criar `src/components/ui/AdminNotice.test.tsx` (modelo: `ErrorPanel.test.tsx` com `renderToStaticMarkup` + um teste jsdom de clique). Cobrar: mensagem simples e mensagem com título+descrição; wrapper `border-warning/20 bg-warning/5`; ícone padrão `ShieldAlert` com `aria-hidden`; `icon` customizado (`Lock`); `compact` (`px-4 py-3` vs `p-4`); botão ausente sem `onRelaunch`; `Reiniciar como admin` com `variant="secondary"` padrão e `variant="outline"` via `relaunchVariant`; `disabled` quando `relaunching`; callback disparado no clique; nenhuma cor fixa. Confirmar falha.
- [ ] **GREEN:** criar `src/components/ui/AdminNotice.tsx` e exportar em `src/components/ui/index.ts`. API: `message: ReactNode`, `onRelaunch?: () => void`, `relaunching?: boolean`, `compact?: boolean`, `icon?: ReactNode` (default `ShieldAlert`, `size-5`/`size-4` conforme `compact`), `relaunchVariant?: ButtonProps['variant']` (default `secondary`). Wrapper: `flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5` + `px-4 py-3` (compact) ou `p-4`. Botão: `size="sm"`, `gap-1.5`, `ShieldCheck size-3.5 aria-hidden`, texto `Reiniciar como admin`; `disabled={relaunching}`; ausente sem callback. Componente é burro — ignora retorno de `onRelaunch`. Rodar teste e confirmar verde.
- [ ] Migrar apenas os quatro avisos inline: `CleanerPage.tsx` (“Itens com cadeado exigem administrador para serem limpos.”, `compact`, `Lock`, callback de `AutoCleanContext`), `OptimizePcPage.tsx` (“Aplicar ajustes precisa de administrador. O resultado continua visível para consulta.”, `compact`, `Lock`, `relaunching={elevating || applying}`), `DebloatPage.tsx` (“Remover apps precisa de administrador. O inventário continua visível para consulta.”, `compact`, `Lock`, `relaunching={elevating}`) e `StartupPage.tsx` (“Sem permissão de administrador” + descrição “Itens do sistema (HKLM, pastas de todos os usuários, tarefas e serviços) aparecem, mas não podem ser alterados. Reinicie o app elevado para controlá-los.”, `p-4`, `ShieldAlert`, `relaunchVariant="outline"`, `elevate` de `useStartup`).
- [ ] **Não** migrar: painel “Limpezas pendentes” de `CleanerPage.tsx`, painel de pendências em `AutoCleanModal.tsx` (têm ações próprias) e o painel completo de `RestorePointsPage.tsx` (exclusão explícita da spec).
- [ ] Rodar testes de `CleanerPage`, `OptimizePcPage`, `DebloatPage`, `StartupPage` e `AutoCleanModal`; confirmar textos, callbacks e ausência do aviso quando já é admin.

### Task 2 — `useLatestRequest` / `useAsyncData`

- [ ] **RED:** criar `src/hooks/use-latest-request.test.tsx`: `next()` incrementa e `isCurrent()` só aceita o último id; `invalidate()` descarta o id anterior; desmontagem durante promise não dispara `setState` (sem aviso do React). Confirmar falha.
- [ ] **GREEN:** criar `src/hooks/use-latest-request.ts` com API exata da spec: `{ next(): number; isCurrent(request: number): boolean; invalidate(): void }`, apenas contador + flag de montagem. Rodar teste.
- [ ] **RED:** criar `src/hooks/use-async-data.test.tsx`: carga inicial (`loading` → `success`), `autoLoad: false`, erro normalizado de `Error`/string, `reload` colocando `loading` **sincronamente** antes do await, duas cargas rápidas → só a última escreve, rejeição obsoleta ignorada, desmontagem durante promise sem `setState`, `setData` atualizando somente em `success`, `onSuccess` apenas da requisição atual. Confirmar falha.
- [ ] **GREEN:** criar `src/hooks/use-async-data.ts`: `useAsyncData<T>(loader: () => Promise<T>, options?: { autoLoad?: boolean; onSuccess?: (data: T) => void })` → `{ state: AsyncState<T>, reload: () => void, setData: (updater: (current: T) => T) => void }`. Guardar `loader` em ref para loader inline não retornar autoLoad; usar `toErrorMessage` de `electron/shared/errors.ts`; tipo `AsyncState<T>` de `electron/shared/ipc-types.ts`. Rodar teste.
- [ ] **Migração 1:** `useStartup.ts`, `useEssentials.ts` e `ScriptContext.tsx` para `useAsyncData`, mantendo shapes públicos (`reload`, `retry` alias, `busy`, snapshot de toggles, progresso de instalação, filtros/subcategorias). Observar que `toggle`/`stopService`/`setData` só valem em `success`.
- [ ] **Migração 2 (somente guardas):** usar `useLatestRequest` em `useAppxInventory.refresh/remove`, `useCleanerItems.refresh`, `RestorePointContext.refresh` e `AutoCleanContext.refresh` — sem forçar `AsyncState` nesses hooks, pois `error` precisa preservar inventário/lista anterior e há estado extra (`isRefreshing`, cache, `lastRefreshed`). Manter o dedupe de `RestorePointContext.fetchRef` intacto.
- [ ] Rodar testes de todos os hooks/contextos listados e o gate completo; confirmar erros exatos (“Instalação cancelada.”, `Falha ao excluir ponto de restauração`), unsubscribe e ausência de avisos de setState após unmount.

### Task 3 — `SettingsSectionShell`

- [ ] **RED:** criar `src/components/settings/SettingsSectionShell.test.tsx` cobrindo título, cada `tone` (`primary` → `bg-primary`, `warning` → `bg-warning`, `info` → `bg-info`, `success` → `bg-success`), `variant="rows"` (`divide-y divide-border rounded-xl border border-border bg-card`, linhas `p-4 transition-colors duration-200 hover:bg-muted/30`) e `variant="panel"` (`rounded-xl border border-border bg-card p-5`), sem cores fixas. Confirmar falha.
- [ ] **GREEN:** criar `src/components/settings/SettingsSectionShell.tsx` com API `title: string`, `tone: 'primary' | 'warning' | 'info' | 'success'`, `variant?: 'rows' | 'panel'` (default `rows`), `children: ReactNode`. Header preservado: `mb-4 flex items-center gap-2`, dot `size-1.5 rounded-full <token>`, `h3.text-sm.font-semibold.text-foreground`. Rodar teste.
- [ ] Migrar sem alterar textos/ordem: `ThemeSection.tsx` (`Tema`/`primary`), `PreferencesSection.tsx` (`Preferencias`/`primary`), `NotificationsSection.tsx` (`Notificacoes`/`warning`), `DataSection.tsx` (`Dados`/`info`), `PageLockSection.tsx` (`Bloqueio de Paginas`/`warning`, `panel`), `UpdatesSection.tsx` (`Atualizacoes`/`success`, `panel`). Preservar `role="status"`/`role="alert"`, `Tentar novamente` e exportar/importar.
- [ ] Criar `NotificationsSection.test.tsx`: `Som nas notificacoes`, `Duracao dos toasts`, opções `Curta (2s)`/`Media (4s)`/`Longa (8s)` e `update` com uma chave por vez.
- [ ] Rodar testes de `src/components/settings` e `SettingsPage.test.tsx`; confirmar seis títulos e um único `max-w-lg`.

### Task 4 — `SettingsPanelShell` / `SettingsApplyFooter`

- [ ] **RED:** criar `src/components/settings/SettingsPanelShell.test.tsx`: título padrão `Ajustes do Windows`, badges `tempo real`/`Por monitor`/`Por disco`, `note`, `gap-4` vs `gap-5`, tokens do tema. Confirmar falha.
- [ ] **GREEN:** criar `SettingsPanelShell.tsx` com `badge: string`, `title?: string` (default `Ajustes do Windows`), `note?: ReactNode`, `className?: string` (via `cn()`), `children: ReactNode`. Estrutura: `<section className="flex flex-col gap-* rounded-xl border border-border bg-card p-5">`, header `flex items-center justify-between gap-3`, badge `shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground`, `note` como `p.text-[10px].text-muted-foreground`. Rodapé continua em `SettingsPreviewLayout` — o shell não engole `footer`.
- [ ] **RED:** criar `src/components/settings/SettingsApplyFooter.test.tsx`: `Aplicar` desabilitado com `isDirty=false`; callbacks de `onApply`, `onDiscard`, `onRestoreDefault`, `onFillDefaults`; `Ajustes aplicados` via `appliedAt`; `Concluído` via `appliedLabel`; `appliedInline` como `<span>` na linha de botões; erro com título padrão/customizado, `role="alert"`, `messageSeparator=": "`, `icon={false}`, `text-destructive`; `children` extras. Confirmar falha.
- [ ] **GREEN:** criar `SettingsApplyFooter.tsx` com `isDirty`, `onApply`, `onDiscard`, `onRestoreDefault?`, `onFillDefaults?`, `busy?`, `appliedAt?`, `applied?`, `appliedLabel?` (default `Ajustes aplicados`), `appliedInline?`, `applyError?`, `applyErrorTitle?` (default `Não foi possível aplicar os ajustes`), `children?`. Botões: `Aplicar` (default), `Restaurar padrão` (secondary), `Cancelar alterações` (ghost), `Preencher com padrões` (ghost); esconder opcionais sem callback. Erro via `ErrorPanel variant="inline"` com `className="mt-2 border-0 bg-transparent p-0"` e título/mensagem `text-xs text-destructive`. Rodar teste.
- [ ] Migrar os quatro painéis: teclado e mouse (`tempo real`, `gap-5`, quatro botões, `appliedAt`), monitor (`Por monitor`, `gap-4`, dois botões, `applied`, título `Não foi possível aplicar`, note “A mudança pode desligar a tela por alguns segundos”), storage (`Por disco`, `gap-4`, ações de disco, `appliedInline` com `Concluído`, título `Não foi possível concluir`, note “A limpeza e a otimização abrem ferramentas do Windows...”). **Não** confundir `onRestoreDefault` (aplica defaults) com `onFillDefaults` (só preenche o draft). Manter cards internos e erros de carga com `ErrorPanel variant="card"`.
- [ ] Rodar testes dos painéis e das páginas `KeyboardPage`, `MousePage`, `MonitorPage`, `StoragePage`; confirmar badges, `data-skeleton`, ordem prévia→controle→ação e estados de desabilitação.

### Task 5 — `VirtualSpacer` / `VirtualTableSpacer`

- [ ] **RED:** criar `src/components/VirtualSpacer.test.tsx`: `VirtualSpacer` com `height`, `testId`, `aria-hidden="true"`, estilo exato e sem classes de cor; `VirtualTableSpacer` com `<tr style>` e `<td colSpan>`, sem `data-testid`. Confirmar falha.
- [ ] **GREEN:** criar `src/components/VirtualSpacer.tsx` com as duas exports; call sites mantêm `paddingTop > 0 && ...` para preservar ausência em zero.
- [ ] Migrar spacers de div: `VirtualizedScriptList.tsx`, `DebloatPage.tsx`, `CleanerPage.tsx` (`virtual-spacer-top`/`virtual-spacer-bottom`). Migrar spacers de tabela: `HistoryPage.tsx` (2, colSpan 5) e `StartupPage.tsx` (6, colSpan 4 e 5). Não usar `TableRow`/`TableCell` — classes extras mudariam o layout.
- [ ] Rodar testes de `VirtualizedScriptList`, `DebloatPage`, `CleanerPage`, `HistoryPage`, `StartupPage`; confirmar `69px`/`138px` e `72px`/`144px`.

### Task 6 — utils de formatação

- [ ] **RED:** estender `src/utils/format.test.ts`: `formatDateTime` (pt-BR com TZ fixado no teste), `plural` (0/1/2), `formatUptimeCompact` (0/90/3661/90061), `formatUptimeLong` (0/3600/90061), `formatElapsedMs` (0/999/1000/1500/60000/90061). Confirmar falha.
- [ ] **GREEN:** acrescentar ao final de `src/utils/format.ts` sem tocar em `formatDuration`: `formatDateTime(value: string | number | Date)` → `new Date(value).toLocaleString('pt-BR')`; `plural(count, singular, pluralForm)` → `` `${count} ${count === 1 ? singular : pluralForm}` ``; `formatUptimeCompact(seconds)` → `d/h/m` com `d h m`; `formatUptimeLong(seconds)` → partes `d/h/min/s` filtradas por `> 0`, fallback `0 s`; `formatElapsedMs(milliseconds)` → `<1000` ms, `<60s` s, senão `m ... s`. Rodar teste.
- [ ] Migrar: `formatDate` local em `HistoryPage.tsx`/`RestorePointsPage.tsx` → `formatDateTime`; `plural` local em `DebloatPage.tsx` e ternários em `ConfirmBulkScriptDialog.tsx`, `ConfirmRemoveAppsDialog.tsx`, `CommandPalette.tsx`, `MeuPcPage.tsx`; `formatUptime` de `DashboardPage.tsx` → `formatUptimeCompact` e o de `MeuPcPage.tsx` → `formatUptimeLong`; `formatDuration` local de `HistoryPage.tsx` → `formatElapsedMs`.
- [ ] **Não** migrar `ConfirmDialog.tsx` (`formatElapsed` próprio, saídas testadas) nem `formatInstallDate` de `MeuPcPage.tsx` (`Intl` com `timeZone: 'UTC'`).
- [ ] Rodar testes de todas as páginas/componentes migrados e o gate completo; confirmar `1 d 1 h 1 min 1 s`, `1d 1h 1m`, `1s`, `2 resultados`.

## Verificação final

- [ ] `bun run lint && bun run typecheck && bun run test` verde.
- [ ] Revisar `README.md`; atualizar somente se houver mudança visível/funcional relevante.
- [ ] Criar `docs/REFATORACAO-P2.md` com alterações, melhorias, correções e decisões de escopo.
- [ ] Commit no branch `refactor/p2-componentizacao` sem push.
