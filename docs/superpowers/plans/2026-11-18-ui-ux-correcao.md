# Correção de UI/UX — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar os achados de `docs/AUDITORIA_UI_UX.md`: contraste ilegível, cores fora do sistema de temas, hovers que escondem texto, foco invisível e animações sem opt-out.

**Architecture:** Primeiro corrige-se a derivação runtime de cores em `SettingsContext` (origem dos hovers quebrados). Depois consolidam-se tokens semânticos em `globals.css`, substituindo-se as classes Tailwind hardcoded por tokens/`color-mix()`. Por fim aplicam-se ajustes de acessibilidade, tipografia e movimento. Cada tarefa termina com gate verde e commit próprio na branch `beta`.

**Tech Stack:** Electron + React 19 + Tailwind CSS 4 + Biome + Vitest; sem novas dependências.

**Spec:** `docs/AUDITORIA_UI_UX.md`

## Global Constraints

- Alvo WCAG 2.1: **4,5:1** para texto, **3:1** para alvos não-textuais, em todos os 6 temas.
- Temas: `light` (Paper), `dark` (Terminal), `midnight`, `amber`, `emerald`, `batman`; base monotemática + 1 acento.
- Nenhuma classe Tailwind de cor fixa (`amber|emerald|yellow|red|cyan|blue|violet|rose|orange|green|pink|indigo|sky` + escala) em `src/**`.
- Nenhum glow `rgba(...)` fixo; usar `color-mix(in srgb, var(--color-primary) N%, transparent)`.
- Reticências tipográficas: `…` (não `...`) em strings visíveis; loading sempre com reticências ou texto de progresso.
- Toda mudança de comportamento/cor ganha teste que falha sem a correção (red→green).
- Gate antes de cada commit: `bun run lint && bun run typecheck && bun run test`; ao final, `bun run build`.
- Nunca commitar `.env.local`. Trabalhar na raiz do repositório, branch `beta`.

## Review Focus

1. Accent personalizado claro (ex.: `#ffd91a`, `#30e86e`): o texto dos botões primários e o texto no hover devem manter ≥4,5:1 — teste: varredura de todos os presets + amarelo/vermelho em `SettingsContext.test.tsx` (Task 1).
2. Tema Paper (fundo claro): nenhum `-400` claro sobre branco e nenhum `text-primary-foreground` sobre `primary/80` — teste: guard de classes hardcoded (Task 4) + teste de variantes (Task 2).
3. Paleta de comandos e abas navegadas por teclado: foco precisa ser visível e o item ativo precisa receber `.focus()` — teste: `Tabs.test.tsx` e `CommandPalette.test.tsx` (Tasks 2 e 8).
4. Modais com listas longas: devem rolar internamente com `overscroll-contain`, sem estourar a janela, e manter títulos truncados acessíveis por `title` — teste de render dos diálogos (Task 8).
5. Temas não-`dark`: `dark:` utilities devem ativar e `color-scheme` deve acompanhar Paper — teste de leitura de `globals.css`/`index.html` (Task 9).

---

### Task 1: Contraste runtime das cores de destaque (P0-1)

**Files:**

- Create: `src/lib/color-contrast.ts`
- Create: `src/lib/color-contrast.test.ts`
- Modify: `src/contexts/SettingsContext.tsx:109-152`
- Modify: `src/contexts/SettingsContext.test.tsx:161-188`

**Interfaces:**

- Consumes: `hexToHsl()` existente em `SettingsContext.tsx`.
- Produces: `Hsl { h,s,l }`, `Rgb { r,g,b }`, `hslToRgb(Hsl): Rgb`, `relativeLuminance(Rgb): number`, `contrastRatio(Rgb,Rgb): number`, `readableForeground(Hsl): { foreground: '#0a0b10'|'#ffffff'; background: Hsl }`, `formatHsl(Hsl): string`.
- `readableForeground` escolhe o texto de maior contraste; se nenhum atingir 4,5:1, ajusta `l` da cor de fundo em passos de 1% até atingir.

- [ ] **Step 1: Escrever teste que falha para amarelo e vermelho**

```ts
// src/lib/color-contrast.test.ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, hslToRgb, readableForeground, relativeLuminance } from './color-contrast';

const DARK = { r: 10, g: 11, b: 16 };
const WHITE = { r: 255, g: 255, b: 255 };

describe('readableForeground', () => {
  it.each([
    { h: 188, s: 86, l: 53 }, // padrão #22d3ee
    { h: 50, s: 100, l: 55 }, // amarelo
    { h: 140, s: 80, l: 55 }, // verde
    { h: 0, s: 100, l: 50 }, // vermelho
    { h: 198, s: 96, l: 38 }, // accent derivado do padrão
  ])('mantém contraste >= 4,5 para $h/$s/$l', (hsl) => {
    const { foreground, background } = readableForeground(hsl);
    const rgb = hslToRgb(background);
    expect(
      contrastRatio(
        relativeLuminance(rgb),
        relativeLuminance(foreground === '#ffffff' ? WHITE : DARK)
      )
    ).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `bunx vitest run src/lib/color-contrast.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/lib/color-contrast.ts`**

Implementar conversão HSL→RGB (formula padrão), luminância WCAG (`0.2126R + 0.7152G + 0.0722B` com linearização), razão de contraste com `+0,05`, e `readableForeground` com ajuste de `l` quando o máximo < 4,5.

- [ ] **Step 4: Rodar o teste e confirmar verde**

Run: `bunx vitest run src/lib/color-contrast.test.ts`
Expected: PASS (5 casos).

- [ ] **Step 5: Atualizar `SettingsContext` e seus testes**

Em `SettingsContext.tsx`, substituir os quatro `setProperty` de foreground/primary/accent por `readableForeground` aplicado a `primary` e `accent` separadamente, e usar `formatHsl`. Em `SettingsContext.test.tsx`, trocar a expectativa de `#ffffff` para `#0a0b10` no caso `#ff0000` e adicionar teste com `#22d3ee` asserting `--color-primary-foreground === '#0a0b10'` e contraste ≥4,5 lido das CSS vars.

- [ ] **Step 6: Rodar testes do contexto, gate e commit**

Run: `bunx vitest run src/contexts/SettingsContext.test.tsx && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `fix: calcula contraste real das cores de destaque`

---

### Task 2: Componentes base legíveis e variant `subtle` (P0-2/3/6/7)

**Files:**

- Modify: `src/components/ui/button.tsx:7-33`
- Modify: `src/components/ui/badge.tsx:6-22`
- Modify: `src/components/ui/dialog.tsx:22,39,45`
- Modify: `src/components/ui/switch.tsx:12,20`
- Modify: `src/components/ui/tabs.tsx:10-81`
- Modify: `src/components/ui/input.tsx:11`
- Modify: `src/components/ui/card.tsx:10`
- Modify: `src/components/ui/table.tsx:54`
- Modify: `src/pages/DebloatPage.tsx:351`, `src/pages/CleanerPage.tsx:492`
- Create: `src/components/ui/ui-tokens.test.tsx`

**Interfaces:**

- Consumes: `cn()` de `@/lib/utils`.
- Produces: `Button` aceita `variant="subtle"`; `Tabs` aceita prop obrigatória `ariaLabel: string`; `Tabs` expõe `interface TabsProps` com esse campo.

- [ ] **Step 1: Escrever testes de render que falham**

```tsx
// src/components/ui/ui-tokens.test.tsx — casos:
// 1) <Button variant="subtle"> contém `bg-card/50` e `hover:bg-muted`
// 2) <Switch /> com estado unchecked tem thumb com `data-[state=unchecked]:bg-muted-foreground`
// 3) <Tabs ariaLabel="Apps" ...> tem role="tablist" com aria-label="Apps"
// 4) seta direita em <Tabs> move o foco para o próximo botão (document.activeElement)
// 5) <Dialog open> close button contém `data-[state=open]:text-accent-foreground`
```

Use `// @vitest-environment jsdom` e `@testing-library/react`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run src/components/ui/ui-tokens.test.tsx`
Expected: FAIL (variant/`ariaLabel` ausentes, classes antigas).

- [ ] **Step 3: Aplicar as correções de classe e props**

- `button.tsx`: `transition-[color,background-color,border-color,box-shadow,opacity]`, glow via `color-mix`, novo variant `subtle: 'border border-border bg-card/50 text-foreground hover:bg-muted hover:text-foreground'`, `hover:bg-accent hover:text-accent-foreground` mantido apenas em `ghost`/`outline` com `outline` passando a usar `bg-card`.
- `badge.tsx`: remover `focus:outline-none focus:ring-*` do `<div>`; `default` hover `hover:bg-accent hover:text-accent-foreground`; `destructive` hover `hover:bg-destructive/90`.
- `dialog.tsx`: close button `data-[state=open]:text-accent-foreground`, sem `opacity-70` quando aberto, `focus-visible:*`, `transition-[...]`; animações com `motion-reduce:animate-none`.
- `switch.tsx`: thumb `data-[state=unchecked]:bg-muted-foreground`; trilho unchecked `bg-input` mantido.
- `tabs.tsx`: prop `ariaLabel`, refs por item, `moveFocus` chama `.focus()`, `focus-visible:ring-2 focus-visible:ring-ring`, aba ativa `bg-primary/20 text-primary` (sem `/15`).
- `input.tsx`: `hover:border-primary/60`, `transition-[border-color,box-shadow]`.
- `card.tsx`: glow `color-mix(...)`, `transition-[border-color,box-shadow]`.
- `table.tsx`: `border-l-2 border-l-transparent` por padrão e `hover:border-l-primary`.
- `DebloatPage`/`CleanerPage`: `variant="subtle"` nos botões “Selecionar recomendados”.

- [ ] **Step 4: Rodar teste e confirmar verde**

Run: `bunx vitest run src/components/ui/ui-tokens.test.tsx`
Expected: PASS.

- [ ] **Step 5: Ajustar chamadores de `<Tabs>`**

Passar `ariaLabel` explícito em todos os usos (`StartupPage`, `DebloatPage` e demais). Rodar `bun run typecheck`.

- [ ] **Step 6: Gate e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `fix: corrige contraste de controles e adiciona botão subtle`

---

### Task 3: Hover e badges em páginas de emuladores (P0-4/5)

**Files:**

- Modify: `src/pages/EmuladoresPage/AppListView.tsx:404,409,424,429,431,514,588,682,693`
- Modify: `src/pages/EmuladoresPage.tsx:38-50,265,372,400`
- Test: arquivo de teste existente da página (criar `EmuladoresPage.badges.test.tsx` se não houver)

**Interfaces:**

- Consumes: `Badge`, `cn()`.
- Produces: nenhuma interface pública nova.

- [ ] **Step 1: Teste de regressão do hover e do badge**

Assertar que o item de menu não contém `text-muted-foreground` em filho que herda hover, e que o badge não aplica `text-blue-400`/`text-emerald-400` sobre `bg-primary`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run <arquivo de teste>`
Expected: FAIL.

- [ ] **Step 3: Corrigir**

Remover `text-muted-foreground` dos `<p>` filhos dos botões de menu; trocar `Badge variant="default"` por `variant="outline"` com cor via `var(--color-primary)`; trocar sombras RGB por `color-mix`.

- [ ] **Step 4: Rodar teste, gate e commit**

Run: `bunx vitest run <arquivo> && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `fix: corrige hover e badges das páginas de emuladores`

---

### Task 4: Tokens semânticos e guard de cores (P1 base)

**Files:**

- Modify: `src/styles/globals.css:3,17,56-89,68,117,152,187,222,257,293-295,322`
- Create: `src/styles/theme-tokens.test.ts`

**Interfaces:**

- Consumes: tokens Tailwind 4 do `@theme`.
- Produces: CSS vars `--color-success`, `--color-warning`, `--color-info`, `--color-selection` por tema, `--color-muted-foreground` corrigido nos 5 temas escuros.

- [ ] **Step 1: Teste que falha**

```ts
// src/styles/theme-tokens.test.ts — @vitest-environment node
// lê globals.css com node:fs e asserta:
// - --color-success/--color-warning/--color-info/--color-selection em todos os blocos de tema
// - nenhum --color-muted-foreground com os hex antigos (#5a6a85, #5a5a7a, #8a7e6e, #5a8a70, #5a5868)
// - @custom-variant dark cobre .dark, .midnight, .amber, .emerald, .batman
// - :root contém color-scheme: light
// - @media (prefers-reduced-motion: reduce) existe
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run src/styles/theme-tokens.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar tokens**

Valores de `--color-muted-foreground`: Terminal `#77859c`, Midnight `#7c7c97`, Amber `#908474`, Emerald `#66947b`, Batman `#7e7c85`. Para `success/warning/info/selection`, usar o acento do tema (`var(--color-primary)`) com variações de `color-mix`; warning pode reutilizar `--color-primary` quando o tema já é âmbar/dourado. Adicionar `color-scheme: light` em `:root`, ampliar `@custom-variant dark` e bloco global de reduced motion.

- [ ] **Step 4: Rodar teste, gate e commit**

Run: `bunx vitest run src/styles/theme-tokens.test.ts && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `fix: unifica tokens semânticos dos temas`

---

### Task 5: Cores hardcoded — páginas principais (P1)

**Files:**

- Modify: `src/pages/EssentialsPage.tsx:38-88,155-194`
- Modify: `src/pages/CpuPage.tsx:17-36,142-145,213-278`
- Modify: `src/pages/NetworkPage.tsx:24-35,216-305`
- Modify: `src/pages/StartupPage.tsx:187,292-296,384,499,611,620,646,653,727-728`
- Modify: `src/pages/HistoryPage.tsx:68,84,89,96,207-234`
- Modify: `src/pages/DashboardPage.tsx` (se houver cor fixa)
- Test: `src/styles/theme-tokens.test.ts` (estender com guard de classes)

**Interfaces:**

- Consumes: tokens da Task 4.
- Produces: nenhuma.

- [ ] **Step 1: Estender guard para falhar com classes fixas**

Adicionar ao teste: nenhum arquivo em `src/pages/**/*.tsx` pode conter regex `text-(amber|emerald|yellow|red|cyan|blue|violet|rose|orange|green|pink|indigo|sky)-[0-9]{3}` ou `bg-/border-` equivalente.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run src/styles/theme-tokens.test.ts`
Expected: FAIL listando as páginas.

- [ ] **Step 3: Substituir classes por tokens**

Status → `text-primary`/`text-destructive`/`text-muted-foreground` + `bg-primary/10`; avisos admin → `border-primary/20 bg-primary/5`; paletas por categoria → `color-mix()` com `--color-primary`; hero da Network → `border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5`; glows → `color-mix`.

- [ ] **Step 4: Rodar guard, gate e commit**

Run: `bunx vitest run src/styles/theme-tokens.test.ts && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `refactor: remove cores fixas das páginas principais`

---

### Task 6: Cores hardcoded — páginas restantes (P1)

**Files:**

- Modify: `src/pages/InputLagPage.tsx:42-77,256,409,426,435,441`
- Modify: `src/pages/CleanerPage.tsx:318-323,459-461,592,599`
- Modify: `src/pages/DebloatPage.tsx:312-314,448`
- Modify: `src/pages/RestorePointsPage.tsx:84-85,148`
- Modify: `src/pages/UtilitiesPage.tsx:77`
- Modify: `src/pages/EmuladoresPage/AppListView.tsx:514,588,682,693`
- Test: `src/styles/theme-tokens.test.ts` (já cobre o guard)

**Interfaces:**

- Consumes: tokens da Task 4.
- Produces: nenhuma.

- [ ] **Step 1: Rodar guard e confirmar quais arquivos ainda falham**

Run: `bunx vitest run src/styles/theme-tokens.test.ts`
Expected: FAIL com a lista residual.

- [ ] **Step 2: Substituir classes por tokens**

Mesmas regras da Task 5; marcadores `bg-yellow-400`/`bg-emerald-400` viram `bg-primary`.

- [ ] **Step 3: Rodar guard, gate e commit**

Run: `bunx vitest run src/styles/theme-tokens.test.ts && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `refactor: remove cores fixas das páginas de manutenção`

---

### Task 7: Componentes e toasts (P1)

**Files:**

- Modify: `src/components/DashboardWidget.tsx:23-36,55-58,72-76,91-93`
- Modify: `src/components/AutoCleanModal.tsx:126,261,266,286`
- Modify: `src/components/ConfirmDialog.tsx:160-255,277`
- Modify: `src/components/ScriptCard.tsx:29-34,49-107,167,180-346`
- Modify: `src/components/ScriptBadge.tsx:32,47`
- Modify: `src/components/ScriptSectionCard.tsx:86-87`
- Modify: `src/components/VirtualizedSectionCard.tsx:153-154`
- Modify: `src/components/settings/NotificationsSection.tsx:10`
- Modify: `src/components/settings/PageLockSection.tsx:114`
- Modify: `src/components/settings/DataSection.tsx:10`
- Modify: `src/components/settings/UpdatesSection.tsx:79,110,159`
- Modify: `src/components/EnhancedToast.tsx:25-30`
- Modify: `src/layout/AppLayout.tsx:24-34`
- Test: `src/styles/theme-tokens.test.ts` (estender guard para `src/components/**`)

**Interfaces:**

- Consumes: tokens da Task 4.
- Produces: `EnhancedToast` usa cor por tipo via tokens.

- [ ] **Step 1: Estender guard a componentes e confirmar falha**

Run: `bunx vitest run src/styles/theme-tokens.test.ts`
Expected: FAIL com a lista de componentes.

- [ ] **Step 2: Substituir cores e corrigir toasts**

`toast[type]` passa a aplicar `bg-primary/10 text-primary` para success/info e `bg-destructive/10 text-destructive` para error/warning; `AppLayout` troca `theme="system"` por `theme` derivado de `settings.theme` e remove `richColors`.

- [ ] **Step 3: Rodar guard, gate e commit**

Run: `bunx vitest run src/styles/theme-tokens.test.ts && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `refactor: alinha componentes e toasts aos temas`

---

### Task 8: Acessibilidade e foco (P2)

**Files:**

- Modify: `src/components/CommandPalette.tsx:99-120,138`
- Modify: `src/components/settings/PageLockSection.tsx:20-26,140,145,165`
- Modify: `src/components/settings/DataSection.tsx:18-38`
- Modify: `src/components/settings/UpdatesSection.tsx:72-74,194-203,214-223`
- Modify: `src/components/AccentColorPicker.tsx:25-42`
- Modify: `src/components/ui/progress.tsx:10`
- Modify: `src/components/ErrorBoundary.tsx:29-39`
- Modify: `src/components/ConfirmCleanDialog.tsx:37-43`
- Modify: `src/components/ConfirmRemoveAppsDialog.tsx:33,37`
- Modify: `src/layout/Sidebar.tsx:151-155`, `src/layout/AppLayout.tsx:48`
- Create: `src/components/CommandPalette.a11y.test.tsx`

**Interfaces:**

- Consumes: `Tabs` com `ariaLabel` (Task 2).
- Produces: `Progress` aceita `ariaLabel?: string`.

- [ ] **Step 1: Testes de foco e nomes acessíveis**

```tsx
// CommandPalette.a11y.test.tsx
// 1) input tem aria-label e role="combobox"
// 2) container do input não tem `outline-none` sem `focus-visible:ring`
// 3) overlay é botão com aria-label
// 4) contagem de resultados tem aria-live="polite"
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run src/components/CommandPalette.a11y.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Aplicar correções de acessibilidade**

Seguir o item 6 do documento de auditoria: `aria-label`, `role`/`aria-*`, `<a>` externo, `aria-pressed` nos swatches, `--tw-ring-color`, foreground calculado no check, `role="alert"` no ErrorBoundary, `overscroll-contain`, `max-h` + scroll no ConfirmCleanDialog, `title` em truncados.

- [ ] **Step 4: Rodar testes, gate e commit**

Run: `bunx vitest run src/components/CommandPalette.a11y.test.tsx && bun run lint && bun run typecheck && bun run test`
Expected: PASS.
Commit: `fix: melhora acessibilidade e foco da interface`

---

### Task 9: Tipografia, movimento e raiz (P2)

**Files:**

- Modify: `index.html:2`
- Modify: `src/styles/globals.css:293-295`
- Modify: `src/pages/SettingsPage.tsx:44`, `src/components/settings/UpdatesSection.tsx:89`, `src/pages/EssentialsPage.tsx:166-171`, `src/pages/NetworkPage.tsx:151,164,189,277`, `src/pages/StartupPage.tsx:325,696,745,751`, `src/pages/RestorePointsPage.tsx:157,170,180,181,202,368`, `src/pages/EmuladoresPage/AppListView.tsx:357,460,540,584,601,617`
- Modify: 29 arquivos com `transition-all` (lista em `docs/AUDITORIA_UI_UX.md`)
- Test: `src/styles/theme-tokens.test.ts` (estender com asserts de `...`, `transition-all`, `motion-reduce`)

**Interfaces:**

- Consumes: tokens da Task 4.
- Produces: nenhuma.

- [ ] **Step 1: Estender guard e confirmar falha**

Assertar: nenhuma string visível `...` em `src/**/*.tsx`, nenhum `transition-all`, pelo menos um `motion-reduce:animate-none` ou `@media (prefers-reduced-motion: reduce)`, `index.html` sem `class="dark"` fixo.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `bunx vitest run src/styles/theme-tokens.test.ts`
Expected: FAIL.

- [ ] **Step 3: Aplicar correções**

`...` → `…`; spinners ganham texto “Carregando…”; `transition-all` → lista explícita; bloco global `@media (prefers-reduced-motion: reduce)` com `animation-duration: 0.01ms !important` e `transition-duration: 0.01ms !important`; remover `class="dark"` do `index.html`.

- [ ] **Step 4: Rodar guard, gate, build e commit**

Run: `bunx vitest run src/styles/theme-tokens.test.ts && bun run lint && bun run typecheck && bun run test && bun run build`
Expected: PASS.
Commit: `fix: padroniza tipografia, movimento e tema inicial`

---

## Self-Review

- Spec coberto: P0-1..P0-7 (Tasks 1-3), P1 (Tasks 4-7), P2 (Tasks 8-9), plano de correção das 4 fases e apêndice (Tasks 4-9).
- Tipos consistentes: `ariaLabel` em `Tabs`, `ariaLabel` em `Progress`, helpers de cor com assinaturas fixas na Task 1.
- Review Focus com testes nas Tasks 1, 2, 4, 8 e 9.
- Proporção: o plano decisões, não transcreve bodies; algoritmos não determinados por testes aparecem só como descrição de uma linha.
