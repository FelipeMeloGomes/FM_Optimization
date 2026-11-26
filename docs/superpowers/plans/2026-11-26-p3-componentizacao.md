# P3 de componentização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar integralmente o P3 de `docs/COMPONENTIZACAO.md`: `SearchInput`, `AsyncButton` e `isIntegerInRange`/`isInRange`.

**Architecture:** Extrair os últimos padrões repetidos da spec para componentes/utils compartilhados, preservando textos, rótulos, `role`s, desabilitação, classes do tema e contratos públicos. Nenhuma mudança de bridge/IPC.

**Tech Stack:** Electron + React 19 + TypeScript, Tailwind CSS 4, Vitest + Testing Library, Biome, bun.

**Spec:** `docs/COMPONENTIZACAO.md` (§2 prioridades, §3.14, §3.15 e §3.17; §4 define o que fica de fora).

**Branch de trabalho:** `refactor/p3-componentizacao`, criada a partir de `refactor/p2-componentizacao` (HEAD `8d321f5`). Sem push nesta rodada.

## Global Constraints

- Cada item novo segue RED→GREEN: escrever o teste, confirmar que falha, implementar, confirmar que passa.
- Todo comportamento visível ao usuário é preservado: textos exatos, placeholders, rótulos, `role`s, desabilitação e ordem de elementos.
- Tokens semânticos do tema (`bg-primary`, `text-primary`, `bg-background`, `border-border`, `text-muted-foreground`, `bg-success`, `bg-warning`, `bg-info`, `text-destructive`); proibidas cores fixas.
- Não migrar buscas de página única não listadas na spec (`CompararPlacaPage`, `RestorePointsPage`) nem `RefreshButton` (já resolvido).
- Gate antes de cada commit: `bun run lint && bun run typecheck && bun run test`.
- `docs/REFATORACAO-P3.md` e `README.md` são atualizados ao final; `.env.local` nunca é commitado.

## Interfaces compartilhadas

- Task 1 produz `SearchInput` com `ariaLabel`, `compact`, `inputRef`, `wrapperClassName`, `bare`, `type` e props HTML repassadas ao `<input>`; as pages migradas consomem exatamente essa API na própria Task 1.
- Task 2 produz `AsyncButton` com `loading`, `loadingLabel`, `busyIcon` e `children`; as pages migradas consomem exatamente essa API na própria Task 2.
- Task 3 produz `electron/main/utils/numeric.ts`; os três serviços consomem `isIntegerInRange`/`isInRange` na própria Task 3.
- Tasks 1, 2 e 3 não compartilham símbolos entre si; conflitos de interface são limites das próprias tasks.

## Tasks

### Task 1 — `SearchInput`

- [ ] **RED:** criar `src/components/ui/SearchInput.test.tsx` (modelo: `AdminNotice.test.tsx`, com `renderToStaticMarkup` e um teste jsdom de digitação). Cobrar: `ariaLabel` vira `aria-label`; `placeholder`/`value`/`onChange` repassados ao input; `type="search"` por padrão e `type="text"` quando informado; ícone `Search` com `aria-hidden="true"`, `pointer-events-none` e `text-muted-foreground`; padding padrão `pl-9` e ícone `left-3 size-4`; `compact` aplica `h-9 pl-8` e ícone `left-2.5 size-3.5`; `wrapperClassName` vai para o `<div>` e `className` para o input; `inputRef` e `ref` recebem o nó; `role="combobox"`, `aria-expanded`, `aria-controls` e `aria-activedescendant` repassados; `bare` remove o visual de campo (sem `border`/`bg-background`/`h-10`) e mantém o `className` do chamador; nenhuma cor fixa. Confirmar falha.
- [ ] **GREEN:** criar `src/components/ui/SearchInput.tsx` e exportar em `src/components/ui/index.ts`. API: `SearchInputProps extends InputHTMLAttributes<HTMLInputElement>` com `ariaLabel: string`, `compact?: boolean`, `inputRef?: Ref<HTMLInputElement>`, `wrapperClassName?: string`, `bare?: boolean`, `type?: 'search' | 'text'` (default `search`). `forwardRef` + callback que preenche também `inputRef`. Wrapper `<div className={cn('relative', wrapperClassName)}>` com `<Search aria-hidden="true" className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground', compact ? 'left-2.5 size-3.5' : 'left-3 size-4')} />`. No modo padrão, renderizar `<Input>` com `pl-9`/`h-9 pl-8`; no modo `bare`, `<input>` sem classes base, apenas as do chamador. Rodar teste e confirmar verde.
- [ ] Migrar os quatro call sites da spec preservando classes e textos: `DebloatPage.tsx` (`ariaLabel="Buscar apps"`, placeholder `Buscar por nome ou pacote…`, `wrapperClassName="w-full sm:max-w-xs"`), `StartupPage.tsx` (`ariaLabel="Buscar na lista"`, `compact`, placeholder `Buscar…`, `wrapperClassName="w-full sm:w-56"`), `AppListView.tsx` (placeholder `Buscar apps…`, `ariaLabel="Buscar apps"`) e `CommandPalette.tsx` (`bare`, `type="text"`, `role="combobox"`, refs e todos os `aria-*` atuais, `wrapperClassName="flex-1"`, classe atual do input com `w-full` em vez de `flex-1`). Remover os `<Search>` avulsos desses quatro pontos e o import de `Search`/`Input` quando ficarem sem uso. **Não** migrar `CompararPlacaPage` nem `RestorePointsPage`.
- [ ] **Verificar:** `bun run test -- src/components/ui/SearchInput.test.tsx src/pages/DebloatPage.test.tsx src/pages/StartupPage.test.tsx src/pages/EmuladoresPage/AppListView.test.tsx src/components/CommandPalette.test.tsx src/components/CommandPalette.a11y.test.tsx` — verde, com `1 resultado`/`2 resultados`, `aria-label="Buscar tweaks"`, `role="combobox"` e as buscas por placeholder intactas. Rodar `bun run lint && bun run typecheck && bun run test`; confirmar verde. Commit.

### Task 2 — `AsyncButton`

- [ ] **RED:** criar `src/components/ui/AsyncButton.test.tsx` (jsdom + `renderToStaticMarkup`). Cobrar: idle mostra `children` inteiros e não mostra `loadingLabel`; loading mostra `loadingLabel`, esconde `children`, aplica `disabled` e `aria-busy="true"`; ícone padrão `Loader2 animate-spin aria-hidden`; `busyIcon` customizado substitui o padrão; `variant`, `size`, `className`, `onClick` e `ref` repassados ao `Button`; `disabled` do chamador continua valendo quando `loading={false}`; nenhuma cor fixa e classes do `Button` presentes. Confirmar falha.
- [ ] **GREEN:** criar `src/components/ui/AsyncButton.tsx` e exportar em `src/components/ui/index.ts`. API da spec: `AsyncButtonProps extends Omit<ButtonProps, 'children'>` com `loading: boolean`, `loadingLabel: string`, `busyIcon?: ReactNode` (default `<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />`) e `children: ReactNode`. Renderizar `<Button {...props} disabled={disabled || loading} aria-busy={loading || undefined}>{loading ? <>{busyIcon}{loadingLabel}</> : children}</Button>`; `forwardRef<HTMLButtonElement, AsyncButtonProps>`. Rodar teste e confirmar verde.
- [ ] Migrar os call sites de botões de ação (não refresh): `CleanerPage.tsx` (`cleaning` / `Limpando…` / `Trash2`), `DebloatPage.tsx` (`removing` / `Removendo…` / `PackageX`), `BulkSelectionToolbar.tsx` (`applying` / `applyingLabel` / `Zap`), `StartupPage.tsx` (dois botões: confirmação com `busy[pending.entry.id]` / `Carregando…` / ícone condicional `Square`/`Power`, e linha de serviço com `busy[service.id]` / `Carregando…` / `Square` com o `<span className="hidden sm:inline">` preservado) e `OptimizePcPage.tsx` (`analyzing` / `Analisando…` / `Play` / `busyIcon` com `size-4`). `ScriptSelectionToolbar.tsx` hoje delega ao `BulkSelectionToolbar` (P1) — migrar o toolbar real, não o stub; registrar ruling.
- [ ] **Verificar:** `bun run test -- src/components/ui/AsyncButton.test.tsx src/pages/CleanerPage.test.tsx src/pages/DebloatPage.test.tsx src/components/BulkSelectionToolbar.test.tsx src/pages/StartupPage.test.tsx src/pages/OptimizePcPage.test.tsx` — verde, com `Limpando…`, `Removendo…`, `Aplicando…`, `Carregando…`, `Analisando…`, `Parar` e `Desativar` intactos. Rodar `bun run lint && bun run typecheck && bun run test`; confirmar verde. Commit.

### Task 3 — `isIntegerInRange`

- [ ] **RED:** criar `electron/main/utils/numeric.test.ts`. Cobrar: `isIntegerInRange` aceita inteiros nos limites inclusivos e valores internos; rejeita `NaN`, `Infinity`, floats, strings, `null`, `undefined`, booleanos, abaixo do mínimo e acima do máximo; funciona com limites negativos; `isInRange` aceita números não inteiros nos limites inclusivos e rejeita fora; ambos com limites invertidos rejeitam tudo. Confirmar falha.
- [ ] **GREEN:** criar `electron/main/utils/numeric.ts` com `export function isIntegerInRange(value: unknown, min: number, max: number): value is number` e `export function isInRange(value: number, min: number, max: number): boolean`. Rodar teste e confirmar verde.
- [ ] Migrar `electron/main/services/mouse-settings.ts` (remover `inRange` local e as checagens redundantes de `typeof`/`Number.isInteger`), `keyboard-settings.ts` (remover `inRange` local) e `display-settings.ts` (`validDimension` e `validFrequency` passam a delegar ao util, preservando os limites `16384`, `DISPLAY_MIN_FREQUENCY` e `DISPLAY_MAX_FREQUENCY`). Mensagens de erro e limites permanecem idênticos. Não tocar em `auto-clean-settings`, `overlay-processes` ou `single-instance` (validações específicas, sem segundo consumidor).
- [ ] **Verificar:** `bun run test -- electron/main/utils/numeric.test.ts electron/main/services/mouse-settings.test.ts electron/main/services/keyboard-settings.test.ts electron/main/services/display-settings.test.ts` — verde, com as mensagens de erro e os limites dos serviços preservados. Rodar `bun run lint && bun run typecheck && bun run test`; confirmar verde. Commit.

## Verificação final

- Revisão da branch inteira contra `7cc136102799e3d9a57e7057e145818d3b173256` (merge-base com `main`), com package de revisão e um revisor de contexto novo.
- Criar `docs/REFATORACAO-P3.md` com escopo, decisões, gate e verificação; adicionar link no `README.md`.
- Gate final: `bun run lint && bun run typecheck && bun run test`.
- Commit final sem push.

## Review Focus

- SearchInput: vazamento de props para o wrapper em vez do input, perda de `ref`/`aria-*` no combobox, ícone sem `aria-hidden`, classes fixas de cor, mudança de placeholder/aria-label.
- AsyncButton: dupla desabilitação, `aria-busy` vazando nos estados idle, perda de `children` ricos (spans com `hidden sm:inline`), ícone de loading sem `aria-hidden`, troca de `variant`/`size`.
- numeric: limites inclusivos, type guard estreitando `unknown`, mensagens de erro dos serviços, limites `16384`/frequência preservados.
- Fora de escopo: P3 não deve migrar buscas de página única, `RefreshButton` ou validações de PID/datas.
