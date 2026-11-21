# Layout Limpeza nas páginas de tweaks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as 7 páginas de tweaks usarem visualmente o mesmo padrão de `CleanerPage.tsx`: barra com checkbox "Selecionar todos" e contador, e uma única lista virtualizada com `divide-y`, sem cards com borda e sem seções.

**Architecture:** Substituir `VirtualizedSectionCard` (uma lista por seção) por `VirtualizedScriptList` (uma lista por página), com `useVirtualRows(scripts, null, ALTURA, listRef)` e `data-index` preservados. A barra `ScriptSelectionToolbar` é reescrita no padrão da Limpeza, mantendo o contrato `selectedScripts`/`onApply` já validado. As páginas achatam suas seções na ordem atual de exibição; Input Lag usa a mesma lista com rótulos curados do registry.

**Tech Stack:** Electron + React 19 + TypeScript, Tailwind CSS 4, Vitest + Testing Library (jsdom), Biome, bun.

**Spec:** `docs/superpowers/specs/2026-11-21-selecao-multipla-tweaks-design.md` (inclui o adendo "Layout idêntico ao da Limpeza")

## Global Constraints

- Referência visual exclusiva: `src/pages/CleanerPage.tsx` (barra nas linhas 475–520, lista nas linhas 522–564).
- Nenhuma página abre com tweak marcado; seleção continua derivada da lista visível (`selectedScripts.length`), nunca de `selectedIds.size`.
- Manter `useVirtualRows(..., null, ..., listRef)` — rolagem da página, sem scroll interno novo — e `data-index` no elemento medido.
- Não alterar `electron/main/**`, `resources/scripts.json`, bridge/IPC ou `window.electronAPI.executeScript(id)`.
- Não mexer em Limpeza, Debloat, DNS, Ferramentas/Utilitários, Dispositivo, Overlay nem Histórico.
- IDs removidos continuam removidos: `inputlag-4`, `tweaks-3`, `tweaks-4`. IDs que devem continuar visíveis: `internet-11`, `apps-1`, `apps-2`, `apps-4`/`apps-6`.
- Interface e documentação em português. Todo código novo com teste de comportamento real.
- Gate antes de cada commit: `bun run lint && bun run typecheck && bun run test`.

## Review Focus

- Lista com milhares de linhas e rolagem da página: `data-index` e spacers precisam continuar corretos — coberto pelo teste de `VirtualizedScriptList` que afere `data-index` e altura dos spacers.
- Usuário clica no checkbox da linha durante um lote: precisa estar desabilitado e não pode marcar — teste do componente.
- `hasSSD()` esconde ids em Armazenamento após a troca de lista: a seleção e o contador precisam continuar sendo podados — teste existente de `StoragePage` revalidado.
- Script interativo em execução: precisa mostrar **Cancelar** na linha sem aplicar timeout — teste do componente com `script.interactive: true`.
- Nenhuma seleção: botão "Aplicar selecionados" desabilitado e barra mostra "0 de N selecionados" — teste da barra.

---

### Task 1: Barra no padrão da Limpeza

**Files:**

- Modify: `src/components/ScriptSelectionToolbar.tsx`
- Test: `src/components/ScriptSelectionToolbar.test.tsx`

**Interfaces:**

- Consumes: `ScriptEntry`, `selectedScripts`, `onApply` (contrato atual, inalterado).
- Produces: mesma props de antes, sem mudança de assinatura.

- [ ] **Step 1: escrever testes de regressão para o novo visual**

Em `ScriptSelectionToolbar.test.tsx`, trocar as asserções de `getByRole('button', { name: 'Selecionar todos' })` por `getByRole('checkbox', { name: /Selecionar todos/ })` e verificar: (a) contador dentro do mesmo `<label>` do checkbox; (b) `Limpar seleção` continua como botão e chama `onClear`; (c) botão "Aplicar selecionados" com nome acessível "Aplicar selecionados" e, durante `applying`, texto "Aplicando…" visível e desabilitado; (d) `onApply` continua recebendo exatamente `selectedScripts`.

- [ ] **Step 2: rodar o arquivo e confirmar que falha**

Run: `bunx vitest run src/components/ScriptSelectionToolbar.test.tsx`
Expected: FAIL nos novos testes de checkbox/label.

- [ ] **Step 3: reescrever a barra**

Estrutura: `<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">`; à esquerda um `<label className="flex items-center gap-2 text-sm text-foreground">` contendo `<input type="checkbox" className="size-4 accent-primary" checked={allSelected} onChange={handleSelectAllClick} disabled={availableIds.length === 0 || applying} />`, o texto `Selecionar todos` e `<span className="text-xs text-muted-foreground">{selectedCount} de {availableIds.length} selecionados</span>`; um `<Button variant="subtle" size="sm">Limpar seleção</Button>` logo depois do label, desabilitado com `selectedCount === 0 || applying`. À direita: progresso, alerta de falhas e o botão de aplicar com ícone `Zap` e texto `Aplicando…`/`Aplicar selecionados`. `id` do checkbox = `select-all-tweaks`.

- [ ] **Step 4: rodar o arquivo e confirmar que passa**

Run: `bunx vitest run src/components/ScriptSelectionToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: gate e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Commit: `refactor: barra de selecao no padrao da limpeza`

---

### Task 2: Lista virtualizada única no padrão da Limpeza

**Files:**

- Create: `src/components/VirtualizedScriptList.tsx`
- Test: `src/components/VirtualizedScriptList.test.tsx`

**Interfaces:**

- Consumes: `ScriptEntry` de `electron/shared/ipc-types`, `useVirtualRows`.
- Produces: `VirtualizedScriptListProps { scripts: ScriptEntry[]; activeExecution: string | null; onCancel: (id: string) => void; selectedIds: Set<string>; onToggle: (id: string) => void; disabled: boolean; labels?: Record<string, { name: string; description: string }> }`.

- [ ] **Step 1: escrever o teste do componente**

Cobrir: (a) `data-testid="tweaks-list"` com `<ul className="divide-y divide-border">` e `li[data-index]`; (b) checkbox de linha com `id="tweak-item-<id>"`, `aria-label="Selecionar <nome>"`, classe `accent-primary` e `onToggle(id)` ao clicar; (c) `<label htmlFor>` envolve o nome do script e clicar no nome alterna a seleção; (d) linha com `activeExecution` mostra **Cancelar** e chama `onCancel(id)`, checkbox desabilitado; (e) `labels` substitui nome/descrição exibidos; (f) `disabled` desabilita todos os checkboxes.

- [ ] **Step 2: rodar o teste e confirmar que falha por módulo ausente**

Run: `bunx vitest run src/components/VirtualizedScriptList.test.tsx`
Expected: FAIL com "Cannot find module".

- [ ] **Step 3: implementar o componente**

Contêiner `relative overflow-hidden rounded-xl border border-border bg-card`, spacers `data-testid="virtual-spacer-top"`/`virtual-spacer-bottom`, `<ul ref={listRef} className="divide-y divide-border">`. Cada linha: `<li data-index={virtualRow.index} ref={measureElement} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', selectedIds.has(script.id) && 'bg-primary/5', isExecuting && 'bg-primary/5')}>` com checkbox `size-4 shrink-0 accent-primary` e `<label htmlFor={checkboxId} className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">` envolvendo ícone `Terminal` em caixa `size-8 rounded-lg bg-muted`, nome (de `labels?.[id]?.name ?? script.name`), `ScriptBadge`, descrição `line-clamp-1 text-xs text-muted-foreground`. Manter `ScriptBadge` e o botão `Cancelar` (ícone `Square`) quando em execução. `useVirtualRows(scripts, null, 69, listRef)`.

- [ ] **Step 4: rodar o teste e confirmar que passa**

Run: `bunx vitest run src/components/VirtualizedScriptList.test.tsx`
Expected: PASS.

- [ ] **Step 5: gate e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Commit: `feat: lista virtualizada de tweaks no padrao da limpeza`

---

### Task 3: Migrar as seis páginas com seções

**Files:**

- Modify: `src/pages/CpuPage.tsx`, `NetworkPage.tsx`, `PersonalizationPage.tsx`, `StoragePage.tsx`, `PrivacySecurityPage.tsx`, `SystemRepairPage.tsx`
- Test: os seis `*.test.tsx` correspondentes

**Interfaces:**

- Consumes: `VirtualizedScriptList` (Task 2), `useScriptPage`, `useScriptSelection`.
- Produces: nenhuma.

- [ ] **Step 1: escrever testes de regressão de layout nas seis páginas**

Para cada página, afirmar que existe `tweaks-list`, que não existe `VirtualizedSectionCard` (nenhum cabeçalho de seção renderizado) e que os ids sensíveis continuam presentes: `tweaks-3`/`tweaks-4` ausentes e `internet-11` presente em `NetworkPage`, `apps-1`/`apps-2` em `PrivacySecurityPage`, `apps-4`/`apps-6` em `PersonalizationPage`. Manter os testes de seleção/aplicação já existentes.

- [ ] **Step 2: rodar os seis arquivos e confirmar que falham**

Run: `bunx vitest run src/pages/CpuPage.test.tsx src/pages/NetworkPage.test.tsx src/pages/PersonalizationPage.test.tsx src/pages/StoragePage.test.tsx src/pages/PrivacySecurityPage.test.tsx src/pages/SystemRepairPage.test.tsx`
Expected: FAIL por ausência de `tweaks-list`.

- [ ] **Step 3: trocar as seções pela lista única**

Em cada página: substituir o import e o bloco `.map((section) => <VirtualizedSectionCard .../>)` por um único `<VirtualizedScriptList scripts={visibleScripts} ... />`. `visibleScripts` passa a ser a lista achatada na ordem das seções (`SECTIONS.flatMap(s => s.scriptIds)` resolvido contra `categoryScripts`, deduplicado), preservando a ordem visual atual. Em `CpuPage`, manter o filtro `BULK_SCRIPT_IDS`. Em `StoragePage`, manter `hasSSD()`. Remover imports de `VirtualizedSectionCard`.

- [ ] **Step 4: rodar os seis arquivos e confirmar que passam**

Run: o mesmo comando do passo 2.
Expected: PASS.

- [ ] **Step 5: gate e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Commit: `refactor: lista unica de tweaks nas seis paginas com secoes`

---

### Task 4: Migrar Input Lag e remover o componente antigo

**Files:**

- Modify: `src/pages/InputLagPage.tsx`, `src/pages/InputLagPage.test.tsx`
- Delete: `src/components/VirtualizedSectionCard.tsx`, `src/components/VirtualizedSectionCard.test.tsx`
- Modify: `README.md`

**Interfaces:**

- Consumes: `VirtualizedScriptList` com `labels` do registry.
- Produces: nenhuma.

- [ ] **Step 1: escrever teste de regressão em InputLagPage**

Afirmar `tweaks-list`, que o nome curado (ex.: "Reduzir Input Lag USB") aparece no `<label>` da linha, que `inputlag-4` não aparece e que marcar a checkbox do registry atualiza o contador da barra.

- [ ] **Step 2: rodar o arquivo e confirmar que falha**

Run: `bunx vitest run src/pages/InputLagPage.test.tsx`
Expected: FAIL por ausência de `tweaks-list`.

- [ ] **Step 3: substituir a grade pela lista e remover o componente antigo**

Trocar o bloco `grid grid-cols-1 gap-3 sm:grid-cols-2` por `<VirtualizedScriptList scripts={selectableScripts} labels={Object.fromEntries(registryItems.map(({item, script}) => [script.id, { name: item.name, description: item.description }]))} ... />`. Remover imports `Square`, `Terminal`, `ScriptBadge`, `Badge`, `Button` e `cn` se ficarem órfãos. Excluir `VirtualizedSectionCard.tsx` e seu teste. Atualizar o README: onde diz "cards de tweaks", descrever lista única no padrão da Limpeza.

- [ ] **Step 4: rodar o arquivo e confirmar que passa**

Run: `bunx vitest run src/pages/InputLagPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: gate final e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: 0 erros; todos os arquivos e testes verdes.
Commit: `refactor: input lag em lista unica e remove card antigo`

---

### Task 5: Revisão final da branch

**Files:** nenhum (somente leitura + registro no ledger `.superpowers/sdd/2026-11-21-selecao-multipla-tweaks/progress.md`)

**Interfaces:**

- Consumes: branch completa.
- Produces: veredito de integração.

- [ ] **Step 1: gerar pacote de revisão e despachar revisor fresco**

BASE = HEAD antes desta mudança; HEAD = último commit da Task 4. Revisar coerência visual com `CleanerPage`, ausência de seções, contratos de seleção, out-of-scope intacto.

- [ ] **Step 2: corrigir Critical/Important, se houver**

Ciclo vermelho-verde para cada correção.

- [ ] **Step 3: rodar o gate uma última vez e registrar no ledger**

Run: `bun run lint && bun run typecheck && bun run test`
Commit: `docs: registra revisao do layout limpeza` (somente se houver alteração no ledger rastreado).

## Fora do plano

- Push, tag, release, build de instalador.
- Mudanças em lógica de execução em lote, hook de seleção ou contexto (jão aprovados).
