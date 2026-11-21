# Seleção múltipla de tweaks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o botão "Executar" individual por checkboxes, "Selecionar todos" e aplicação em lote sequencial nas 7 páginas de tweaks listadas no desenho.

**Architecture:** Um hook de seleção por página guarda os ids marcados; uma barra compartilhada oferece "Selecionar todos", contador e "Aplicar selecionados"; `useScriptPage` cuida da confirmação em lote e delega a execução a `executeBatch` no `ScriptExecutionContext`, que espera o evento `script-ended` antes de iniciar o próximo script. Nenhuma mudança na bridge/IPC.

**Tech Stack:** Electron + React 19 + TypeScript, Tailwind CSS 4, Vitest + Testing Library, Biome, bun.

**Spec:** `docs/superpowers/specs/2026-11-21-selecao-multipla-tweaks-design.md`

## Global Constraints

- Páginas do escopo: InputLag, Cpu ("Otimização do sistema"), Personalização, Network (Internet), Armazenamento, Privacidade, Reparo do Sistema. Nenhuma outra página muda.
- Estado inicial da seleção: **nenhum tweak marcado**.
- Referência de funcionamento: página Limpeza (barra, contador, checkbox por item, botão único de aplicar).
- Scripts que saem da listagem e viram botão "Selecionar todos": `inputlag-4`, `tweaks-3`, `tweaks-4`. Continuam no catálogo; `internet-11` e `apps-1` permanecem como cards.
- Lote **sequencial**: `executeBatch(scripts: ScriptEntry[])` espera `script-ended` do id atual antes do próximo; timeout de **30 minutos** para scripts não interativos, sem timeout para `interactive: true`.
- Não alterar `electron/main/**`, `resources/scripts.json` nem a bridge `window.electronAPI.executeScript(id)`.
- Não introduzir scroll interno novo; manter `useVirtualRows(..., null, ..., listRef)` e `data-index` nas linhas medidas.
- Toda interface em português. Todo código novo com teste de comportamento real. Sem push, tag ou release.
- Gate antes de cada commit e no final: `bun run lint && bun run typecheck && bun run test`.

## Review Focus

- **Card de "todas as opções" vazar de volta:** `inputlag-4`, `tweaks-3` e `tweaks-4` não podem aparecer nas 7 páginas, embora continuem no catálogo — Tasks 7 e 8 (testes de ausência por nome).
- **`executeScript` resolve na hora (só faz `spawn`):** se o lote usar `await execute(id)` direto, todos os tweaks disparam ao mesmo tempo — Task 2 (teste de que o segundo `executeScript` só é chamado após `script-ended` do primeiro).
- **Filtros mudando com seleção ativa:** RAM de `CpuPage` e `hasSSD()` de `StoragePage` podem esconder scripts já marcados; o botão não pode aplicar o que não está mais visível — Tasks 1, 8 e 9 (teste de poda da seleção e contagem atualizada).
- **Script interativo travado:** `apps-2`, `apps-4` e `apps-6` abrem janela e só terminam quando a pessoa fecha; o timeout de 30 min não pode abortá-los — Task 2 (teste com fake timers).
- **Zero selecionados / cancelamento:** "Aplicar selecionados" desabilitado com nada marcado, e cancelar o script atual não pode travar o lote — Tasks 4 e 2 (testes de botão desabilitado e de `cancelled: true` liberando o próximo passo).

---

### Task 1: Hook de seleção por página

**Files:**

- Create: `src/hooks/use-script-selection.ts`
- Test: `src/hooks/use-script-selection.test.tsx`

**Interfaces:**

- Consumes: `ScriptEntry` de `../../electron/shared/ipc-types`.
- Produces: `useScriptSelection(availableScripts: ScriptEntry[]): { selectedIds: Set<string>; selectedScripts: ScriptEntry[]; availableIds: string[]; allSelected: boolean; toggle(id: string): void; selectAll(): void; clear(): void; isSelected(id: string): boolean }`.

- [ ] **Step 1: Write the failing test**

`src/hooks/use-script-selection.test.tsx` (`// @vitest-environment jsdom`, `renderHook`/`act`):

```tsx
const A = script('a');
const B = script('b');
const { result, rerender } = renderHook(
  ({ scripts }: { scripts: ScriptEntry[] }) => useScriptSelection(scripts),
  { initialProps: { scripts: [A, B] } }
);
expect(result.current.selectedIds.size).toBe(0);
expect(result.current.availableIds).toEqual(['a', 'b']);
expect(result.current.allSelected).toBe(false);

act(() => result.current.toggle('a'));
expect(result.current.selectedScripts.map((s) => s.id)).toEqual(['a']);

act(() => result.current.selectAll());
expect(result.current.selectedIds).toEqual(new Set(['a', 'b']));
expect(result.current.allSelected).toBe(true);

rerender({ scripts: [B] });
expect(result.current.selectedIds).toEqual(new Set(['b']));
expect(result.current.selectedScripts).toEqual([B]);
expect(result.current.allSelected).toBe(true);

act(() => result.current.clear());
expect(result.current.selectedIds.size).toBe(0);
```

`script(id)` devolve um `ScriptEntry` mínimo (mesmo formato dos testes de hook existentes).

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/hooks/use-script-selection.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement `useScriptSelection`**

Derive `availableIds` com `useMemo` a partir de `availableScripts`; guarde `selectedIds: Set<string>` começando com `new Set()`; em `useEffect`, remova da seleção todo id que não esteja mais em `availableIds` (só chame `setSelectedIds` se algo mudou); `selectedScripts` = `availableScripts.filter(s => selectedIds.has(s.id))`; `allSelected` = `availableIds.length > 0 && availableIds.every(id => selectedIds.has(id))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/hooks/use-script-selection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/use-script-selection.ts src/hooks/use-script-selection.test.tsx
git commit -m "feat: adiciona selecao multipla de tweaks por pagina"
```

### Task 2: Executor sequencial no contexto de execução

**Files:**

- Modify: `src/contexts/ScriptExecutionContext.tsx`
- Test: `src/contexts/ScriptExecutionContext.test.tsx`

**Interfaces:**

- Consumes: `ScriptEntry`, `ScriptEnded` (`electron/shared/ipc-types`), `window.electronAPI.executeScript/cancelExecution/onScriptEnded`.
- Produces: `ScriptExecutionContextValue` existente + `batch: { ids: string[]; index: number } | null` (índice 1-based) e `executeBatch(scripts: ScriptEntry[]): Promise<{ failedIds: string[] }>`. `execute(id): Promise<void>` mantém assinatura e callers atuais.

- [ ] **Step 1: Write the failing test**

`src/contexts/ScriptExecutionContext.test.tsx`: mock `window.electronAPI` com `executeScript: vi.fn(async () => 'started')`, `cancelExecution: vi.fn(async () => {})` e `onScriptEnded` registrando callbacks em `listeners` e devolvendo unsubscribe. Renderize `ScriptExecutionProvider` com um componente sonda que expõe `useScriptExecutionContext()` via `renderHook` + `wrapper`. Helper `emit(data: ScriptEnded)` chama todos os listeners. Scripts A (não interativo) e B (não interativo).

```tsx
let pending!: Promise<{ failedIds: string[] }>;
await act(async () => {
  pending = result.current.executeBatch([A, B]);
  await Promise.resolve();
});
expect(api.executeScript).toHaveBeenCalledTimes(1);
expect(result.current.batch).toEqual({ ids: ['a', 'b'], index: 1 });

await act(async () => {
  emit({ id: 'a', code: 0 });
  await pending;
});
expect(api.executeScript).toHaveBeenNthCalledWith(2, 'b');
expect(result.current.batch).toBeNull();
expect((await pending).failedIds).toEqual([]);
```

Acrescente três testes: (1) `code: 1` em A e `code: 0` em B devolve `failedIds: ['a']` e roda B; (2) `cancelled: true` em A libera B sem registrar falha; (3) com `vi.useFakeTimers()`, script `interactive: true` não dispara após `vi.advanceTimersByTime(31 * 60 * 1000)` e script não interativo estoura em `30 * 60 * 1000`, registrando falha e seguindo para o próximo.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/contexts/ScriptExecutionContext.test.tsx`
Expected: FAIL — `executeBatch` não existe.

- [ ] **Step 3: Implement `executeBatch`**

Extraia o corpo atual de `execute` para `runOne(id): Promise<boolean>` (seta `activeRef`/`activeExecution`, chama `executeScript`, devolve `false` e limpa estado em caso de erro); `execute` continua chamando `runOne` e ignorando o booleano. Em `executeBatch`, para cada script: sete `batch`, registre `onScriptEnded` filtrando `data.id === script.id` **antes** de chamar `runOne`, aguarde o evento com `Promise.race` contra um `setTimeout` de 30 min apenas quando `script.interactive !== true`; trate `code !== 0 || data.cancelled` como falha e timeout como falha; sempre remova o listener e o timer antes do próximo passo; ao final, limpe `batch`/`activeExecution` e devolva `{ failedIds }`. Nunca use `Promise.all`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/contexts/ScriptExecutionContext.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Check gate and commit**

Run: `bun run lint && bun run typecheck && bun run test`

```powershell
git add src/contexts/ScriptExecutionContext.tsx src/contexts/ScriptExecutionContext.test.tsx
git commit -m "feat: executa lote de tweaks em sequencia esperando script-ended"
```

### Task 3: API de lote no `useScriptPage`

**Files:**

- Modify: `src/hooks/use-script-page.ts`
- Test: `src/hooks/use-script-page.test.tsx`

**Interfaces:**

- Consumes: `executeBatch`, `batch` do `ScriptExecutionContext` (Task 2).
- Produces: API individual existente **inalterada** + `batch`, `failedScripts: ScriptEntry[]`, `handleApply(scripts: ScriptEntry[]): void`, `confirmBulkScripts: ScriptEntry[]`, `setConfirmBulkScripts(scripts: ScriptEntry[]): void`, `handleConfirmBulk(): void`, `clearFailures(): void`.

- [ ] **Step 1: Write the failing test**

No mock de `ScriptExecutionContext` do teste, acrescente `executeBatch: vi.fn(async () => ({ failedIds: [] }))` e `batch: null`; no `beforeEach`, `mockClear()`. Novos casos:

```tsx
act(() => result.current.handleApply([SCRIPTS[0], SCRIPTS[1]]));
expect(store.executeBatch).toHaveBeenCalledWith([SCRIPTS[0], SCRIPTS[1]]);
expect(result.current.confirmBulkScripts).toEqual([]);

store.confirmOnExecute = true;
act(() => result.current.handleApply([SCRIPTS[0]]));
expect(store.executeBatch).not.toHaveBeenCalled();
expect(result.current.confirmBulkScripts.map((s) => s.id)).toEqual(['cpu-18']);
act(() => result.current.handleConfirmBulk());
expect(store.executeBatch).toHaveBeenCalledWith([SCRIPTS[0]]);
expect(result.current.confirmBulkScripts).toEqual([]);
```

Acrescente caso com `executeBatch` devolvendo `failedIds: ['cpu-16']`: `failedScripts` deve conter o script `cpu-16`, e `clearFailures()` deve esvaziar.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/hooks/use-script-page.test.tsx`
Expected: FAIL — propriedades ausentes em `result.current`.

- [ ] **Step 3: Implement the batch API**

`handleApply` guarda os scripts em `confirmBulkScripts` quando `settings.confirmOnExecute`, senão chama direto `executeBatch(scripts)` e guarda `failedScripts` mapeando `failedIds` contra o array recebido. `handleConfirmBulk` repete a chamada com `confirmBulkScripts` e limpa o estado. Repasse `batch` do contexto. Mantenha `handleConfirmExecute`/`ConfirmDialog` intactos para as páginas fora do escopo.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/hooks/use-script-page.test.tsx`
Expected: PASS (testes antigos + novos).

- [ ] **Step 5: Check gate and commit**

Run: `bun run lint && bun run typecheck && bun run test`

```powershell
git add src/hooks/use-script-page.ts src/hooks/use-script-page.test.tsx
git commit -m "feat: liga confirmacao e progresso do lote ao hook de pagina"
```

### Task 4: Barra de seleção

**Files:**

- Create: `src/components/ScriptSelectionToolbar.tsx`
- Test: `src/components/ScriptSelectionToolbar.test.tsx`

**Interfaces:**

- Consumes: `ScriptEntry` de `../../electron/shared/ipc-types`.
- Produces: `ScriptSelectionToolbar({ availableIds, selectedIds, onSelectAll, onClear, onApply, applying, progress, failedScripts, onDismissFailures })` com props `string[]`, `Set<string>`, quatro callbacks, `boolean`, `{ index: number; total: number } | null`, `ScriptEntry[]` e callback.

- [ ] **Step 1: Write the failing test**

```tsx
const view = render(
  <ScriptSelectionToolbar
    availableIds={['a', 'b', 'c']}
    selectedIds={new Set()}
    onSelectAll={onSelectAll}
    onClear={onClear}
    onApply={onApply}
    applying={false}
    progress={null}
    failedScripts={[]}
    onDismissFailures={onDismissFailures}
  />
);
expect(screen.getByText('0 de 3 selecionados')).not.toBeNull();
expect(screen.getByRole('button', { name: 'Selecionar todos' })).not.toBeNull();
expect(
  (screen.getByRole('button', { name: 'Aplicar selecionados' }) as HTMLButtonElement).disabled
).toBe(true);
fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
expect(onSelectAll).toHaveBeenCalledTimes(1);
```

Repita com `selectedIds={new Set(['a','b','c'])}` esperando **Limpar seleção** e botão de aplicar habilitado; com `applying` e `progress={{index:2,total:5}}` esperando `role="status"` com `2 de 5` e aplicar desabilitado; com `failedScripts={[script('b')]}` esperando `role="alert"` contendo o nome e clique em **Fechar** chamando `onDismissFailures`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/ScriptSelectionToolbar.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement the toolbar**

Use `Button`/`Badge` de `./ui`, `className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"` (padrão da barra de `CleanerPage`). `allSelected = availableIds.length > 0 && availableIds.every(id => selectedIds.has(id))`. Sem scroll interno.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/ScriptSelectionToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ScriptSelectionToolbar.tsx src/components/ScriptSelectionToolbar.test.tsx
git commit -m "feat: adiciona barra de selecionar todos e aplicar tweaks"
```

### Task 5: Confirmação do lote

**Files:**

- Create: `src/components/ConfirmBulkScriptDialog.tsx`
- Test: `src/components/ConfirmBulkScriptDialog.test.tsx`

**Interfaces:**

- Consumes: `Button`, `Dialog`, `DialogContent`, `DialogTitle` de `./ui`; `ScriptEntry`.
- Produces: `ConfirmBulkScriptDialog({ open, onOpenChange, scripts, onConfirm })`.

- [ ] **Step 1: Write the failing test**

```tsx
render(
  <ConfirmBulkScriptDialog
    open
    onOpenChange={onOpenChange}
    scripts={[script('a', 'Primeiro tweak'), script('b', 'Segundo tweak')]}
    onConfirm={onConfirm}
  />
);
expect(screen.getByText('Confirmar aplicação')).not.toBeNull();
expect(screen.getByText(/Os 2 tweaks abaixo serão aplicados em sequência/)).not.toBeNull();
expect(screen.getByText('Primeiro tweak')).not.toBeNull();
expect(screen.getByText('Segundo tweak')).not.toBeNull();
fireEvent.click(screen.getByRole('button', { name: 'Aplicar 2 tweaks' }));
expect(onConfirm).toHaveBeenCalledTimes(1);
```

Inclua a nota sobre scripts interativos e teste do botão **Cancelar** chamando `onOpenChange(false)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/ConfirmBulkScriptDialog.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement the dialog**

Espelhe `ConfirmCleanDialog`: lista `<li>` com os nomes, texto "Scripts interativos abrem uma janela e só terminam quando você a fechar.", botões **Cancelar** (`variant="outline"`) e **Aplicar N tweaks**.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/ConfirmBulkScriptDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ConfirmBulkScriptDialog.tsx src/components/ConfirmBulkScriptDialog.test.tsx
git commit -m "feat: adiciona confirmacao da aplicacao em lote"
```

### Task 6: Checkbox nas linhas do card virtualizado

**Files:**

- Modify: `src/components/VirtualizedSectionCard.tsx`
- Test: `src/components/VirtualizedSectionCard.test.tsx`

**Interfaces:**

- Consumes: props novas `selectedIds: Set<string>`, `onToggle(id: string): void`, `disabled: boolean`.
- Produces: mesmo componente, sem `onConfirmExecute` e sem botão **Executar**; `onCancel` e `data-index` permanecem. Componente usado apenas pelas 6 páginas do escopo.

- [ ] **Step 1: Write the failing test**

Em `renderCard`, passe `selectedIds`, `onToggle` e `disabled`, removendo `onConfirmExecute`. Substitua os casos de "ações" por:

```tsx
const { onToggle, selectedIds } = renderCard({ scripts: [BLOAT] }); // selectedIds vazio
const check = screen.getByRole('checkbox', { name: 'Selecionar Remover Apps de Terceiros' });
expect((check as HTMLInputElement).checked).toBe(false);
fireEvent.click(check);
expect(onToggle).toHaveBeenCalledWith('apps-3');
```

Acrescente: checkbox marcado quando `selectedIds` contém o id; checkbox desabilitado com `disabled: true`; nenhum botão `/Executar/`; **Cancelar** ainda chama `onCancel('apps-3')` com `activeExecution: 'apps-3'`; `data-index` continua `"0"`. Ajuste o teste de catálogo grande para contar 40 checkboxes.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/VirtualizedSectionCard.test.tsx`
Expected: FAIL — props novas ausentes e asserções de botão.

- [ ] **Step 3: Implement the row change**

Em `ScriptRowProps`, troque `isScriptApplied`/`onConfirmExecute` por `isSelected`, `onToggle`, `disabled`; renderize `<input type="checkbox" aria-label={`Selecionar ${script.name}`} checked={isSelected} disabled={disabled || isScriptExecuting} onChange={() => onToggle(script.id)} />` antes do texto e mantenha o botão **Cancelar** apenas quando `isScriptExecuting`. Remova import de `useIsScriptApplied` e `Play` se ficarem órfãos. Passe as props de `VirtualizedSectionCard` para cada linha.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/VirtualizedSectionCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify local checks, but do not commit yet**

Run: `bunx vitest run src/components/VirtualizedSectionCard.test.tsx && bun run typecheck`
Expected: ambas passam. A suíte completa ainda vai falhar porque os testes das páginas seguem chamando botões **Executar**; isso é resolvido nas Tasks 7–9. O commit único das mudanças de UI está no Step 5 da Task 9.

### Task 7: Página Input Lag

**Files:**

- Modify: `src/pages/InputLagPage.tsx`
- Test: `src/pages/InputLagPage.test.tsx`

**Interfaces:**

- Consumes: `useScriptSelection` (Task 1), `ScriptSelectionToolbar` (Task 4), `ConfirmBulkScriptDialog` (Task 5), `batch`/`handleApply`/`confirmBulkScripts`/`setConfirmBulkScripts`/`failedScripts`/`clearFailures` do `useScriptPage` (Task 3).

- [ ] **Step 1: Write the failing test**

No mock de `use-script-page` do teste, substitua `handleConfirmExecute`/`confirmScript`/`setConfirmScript`/`handleConfirm` por `handleApply: vi.fn()`, `batch: null`, `confirmBulkScripts: []`, `setConfirmBulkScripts: vi.fn()`, `failedScripts: []`, `clearFailures: vi.fn()`. Em `NAMES`, remova `inputlag-4` (restam 5 ids). Ajuste os testes de selo de `6 tweaks` para `5 tweaks` e `5 tweaks` → `4 tweaks` no caso de catálogo incompleto. Novos casos:

```tsx
render(<InputLagPage />);
expect(bodyText()).not.toContain('Aplicar Todas Otimizações');
expect(bodyText()).toContain('5 tweaks');
const check = screen.getByRole('checkbox', { name: 'Selecionar TCPNoDelay' });
fireEvent.click(check); // seleção é local ao hook real; use handleApply via clique em Aplicar
fireEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados' }));
expect(store.handleApply).toHaveBeenCalledTimes(1);
expect(store.handleApply.mock.calls[0][0].map((s: ScriptEntry) => s.id)).toEqual(['inputlag-6']);
```

O teste usa o hook real de seleção (não mocká-lo). Remova o teste de "Executar novamente" (botão não existe mais); mantenha o de cancelamento clicando em **Cancelar** quando `activeExecution` é um id visível (`inputlag-6`).

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/pages/InputLagPage.test.tsx`
Expected: FAIL — card removido e API antiga no mock.

- [ ] **Step 3: Refactor the page**

Remova `r1` de `REGISTRY_SCRIPTS` e o import de `ConfirmDialog`/`useIsScriptApplied`/`Play`/`Badge` se órfãos. Derive `selectableScripts = registryItems.map(({ script }) => script)`, chame `useScriptSelection(selectableScripts)` e renderize a barra acima da grade. Em cada card, substitua o botão por checkbox com `aria-label={`Selecionar ${item.name}`}`, mantendo `ring-2 ring-primary/50` quando selecionado ou executando. Renderize `ConfirmBulkScriptDialog` no fim com as props do hook.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/pages/InputLagPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify local tests, but do not commit yet**

Run: `bunx vitest run src/pages/InputLagPage.test.tsx`
Expected: PASS. A suíte completa ainda depende das Tasks 8–9; o commit conjunto está no Step 5 da Task 9.

### Task 8: Otimização do sistema e Internet

**Files:**

- Modify: `src/pages/CpuPage.tsx`, `src/pages/NetworkPage.tsx`
- Test: `src/pages/CpuPage.test.tsx`, `src/pages/NetworkPage.test.tsx`

**Interfaces:**

- Consumes: mesma API das Tasks 1, 3, 4, 5, 6.

- [ ] **Step 1: Write the failing tests**

Nos mocks de `use-script-page` dos dois testes, troque a API individual pela de lote (como na Task 7).

`CpuPage.test.tsx`: inclua `tweaks-3`/`tweaks-4` na categoria Windows do catálogo de teste e asserte que **Otimizar Hardware** e **Modo Gamer** não aparecem; clique na checkbox de um tweak visível, clique em **Aplicar selecionados** e confira `handleApply` com apenas aquele script.

`NetworkPage.test.tsx`: substitua o teste "executa o script da seção chamando handleConfirmExecute" por: checkbox `Selecionar <nome>` → **Aplicar selecionados** → `handleApply` com o script; acrescente que **Reverter Internet** (`internet-11`) continua visível e selecionável.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/pages/CpuPage.test.tsx src/pages/NetworkPage.test.tsx`
Expected: FAIL — botões antigos e cards de pacote amplo ainda presentes.

- [ ] **Step 3: Refactor both pages**

Em `CpuPage`, filtre `const BULK_SCRIPT_IDS = ['tweaks-3', 'tweaks-4']` de `categoryScripts` antes de montar `cpuScripts`/`sections`; a seleção usa a união dos scripts das seções visíveis (já com a escada de RAM aplicada). Em `NetworkPage`, derive os scripts visíveis da união dos `scriptIds` de `NETWORK_SECTIONS`. Em ambos: `useScriptSelection(visibleScripts)`, barra acima das seções, `ConfirmBulkScriptDialog` no fim, remoção de `ConfirmDialog`/`onConfirmExecute`/`handleConfirmExecute`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/pages/CpuPage.test.tsx src/pages/NetworkPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify local tests, but do not commit yet**

Run: `bunx vitest run src/pages/CpuPage.test.tsx src/pages/NetworkPage.test.tsx`
Expected: PASS. A suíte completa ainda depende da Task 9; o commit conjunto está no Step 5 da Task 9.

### Task 9: Personalização, Armazenamento, Privacidade e Reparo

**Files:**

- Modify: `src/pages/PersonalizationPage.tsx`, `src/pages/StoragePage.tsx`, `src/pages/PrivacySecurityPage.tsx`, `src/pages/SystemRepairPage.tsx`
- Test: os quatro `*.test.tsx` correspondentes

**Interfaces:**

- Consumes: mesma API das Tasks 1, 3, 4, 5, 6.

- [ ] **Step 1: Write the failing tests**

Nos quatro testes, troque o mock de `use-script-page` pela API de lote. Para cada página: marque uma checkbox visível, clique em **Aplicar selecionados** e confira `handleApply` com o script correspondente. Casos específicos:

- `PersonalizationPage`: `apps-4` (Equicord, interativo) continua visível e selecionável.
- `StoragePage`: com `hasSSD() === false`, `util-4` e `builtin-88` não aparecem; marque um tweak, altere o catálogo para remover o id marcado via rerender do mock e confirme que o contador cai e que `handleApply` não recebe o id removido.
- `PrivacySecurityPage`: `apps-1` e `apps-2` continuam visíveis.
- `SystemRepairPage`: clique em **Cancelar** com `activeExecution` setado ainda chama `handleCancel`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/pages/PersonalizationPage.test.tsx src/pages/StoragePage.test.tsx src/pages/PrivacySecurityPage.test.tsx src/pages/SystemRepairPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Refactor the four pages**

Para cada uma: `useScriptSelection(visibleScripts)` (em `StoragePage`, `visibleScripts` é o array já filtrado por `hasSSD`), barra acima das seções, `ConfirmBulkScriptDialog` no fim, `VirtualizedSectionCard` com `selectedIds`/`onToggle`/`disabled={!!batch}`, remoção de `ConfirmDialog` e da API individual.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/pages/PersonalizationPage.test.tsx src/pages/StoragePage.test.tsx src/pages/PrivacySecurityPage.test.tsx src/pages/SystemRepairPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Check gate and commit**

Run: `bun run lint && bun run typecheck && bun run test`

```powershell
git add src/components/VirtualizedSectionCard.tsx src/components/VirtualizedSectionCard.test.tsx src/pages/InputLagPage.tsx src/pages/InputLagPage.test.tsx src/pages/CpuPage.tsx src/pages/CpuPage.test.tsx src/pages/NetworkPage.tsx src/pages/NetworkPage.test.tsx src/pages/PersonalizationPage.tsx src/pages/PrivacySecurityPage.tsx src/pages/StoragePage.tsx src/pages/SystemRepairPage.tsx src/pages/PersonalizationPage.test.tsx src/pages/PrivacySecurityPage.test.tsx src/pages/StoragePage.test.tsx src/pages/SystemRepairPage.test.tsx
git commit -m "refactor: selecao multipla de tweaks nas sete paginas"
```

### Task 10: Documentação e gate final

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: comportamento entregue nas Tasks 1–9.

- [ ] **Step 1: Update README copy**

Na linha de **Input Lag**, troque "6 ajustes de registro ... (todos os tweaks, USB, TCPNoDelay, prioridade, cache e atraso de menu)" por "5 ajustes de registro ... (USB, TCPNoDelay, prioridade, cache e atraso de menu)". Acrescente logo abaixo do título **Otimização do Sistema** um parágrafo: as sete páginas de tweaks (Input Lag, Otimização do sistema, Personalização, Internet, Armazenamento, Privacidade e Reparo do Sistema) agora usam seleção múltipla — marque os cards, use **Selecionar todos** e **Aplicar selecionados**; os tweaks rodam em sequência e scripts interativos abrem janela própria. Ajuste a frase de "cards de tweaks" na seção Interface, se necessário, para refletir os checkboxes.

- [ ] **Step 2: Run the full gate**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: 0 erros; todos os arquivos de teste passando.

- [ ] **Step 3: Verify working tree and commit**

Run: `git status --short` — só `README.md` modificado (ou nada, se o passo 1 não achou texto a mudar).

```powershell
git add README.md
git commit -m "docs: documenta selecao multipla de tweaks"
```

## Self-Review

- **Spec coverage:** seleção vazia por padrão (Task 1), barra/botão "Selecionar todos" (Tasks 4, 7–9), confirmação (Task 5), lote sequencial e progresso (Task 2), 7 páginas (Tasks 7–9), remoção dos 3 pacotes amplos (Tasks 7–8), preservação de `internet-11`/`apps-1` (Tasks 8–9), sem scroll novo (Task 6 mantém `useVirtualRows` com `null`), README (Task 10).
- **Review Focus:** cada risco listado no topo tem teste explícito em uma task: Tasks 7/8 (pacotes), Task 2 (spawn vs. término, timeout, cancelamento), Tasks 1/8/9 (filtros), Task 4 (zero selecionados).
- **Proportion:** o plano detalha assinaturas e asserções, não corpos de implementação; as partes repetitivas das páginas são descritas uma vez e referenciadas.
