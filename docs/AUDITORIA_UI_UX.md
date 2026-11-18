# Auditoria de UI/UX — FM Optimize

**Data:** 18/11/2026 · **Branch:** `beta` · **Tipo:** análise estática (código), sem captura visual de tema.

**Escopo:** `src/**/*.{ts,tsx,css}`, `index.html`, `src/contexts/SettingsContext.tsx`, componentes base (`src/components/ui/**`), páginas, layout e sistema de temas.

**Método:** Web Interface Guidelines (Vercel, obtidos em 18/11/2026) + princípios de design de frontend; três varreduras independentes (tema/tokens, páginas, acessibilidade) + cálculo WCAG 2.1 dos pares de cor.

> Nenhum arquivo de código foi modificado. Este documento é apenas o diagnóstico.

---

## 1. Sumário executivo

| Prioridade | Achado                                                                                                                                                                                 | Impacto                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **P0**     | `SettingsContext.tsx:139-145` escolhe a cor do texto com `l > 60`, sem medir contraste. Com a cor padrão `#22d3ee`, o texto dos botões primários fica **1,81:1** (branco sobre ciano). | Botões principais e hovers ilegíveis **por padrão**, em qualquer tema. É exatamente o sintoma relatado. |
| **P0**     | `dialog.tsx:45` — `muted-foreground` sobre `accent` no botão de fechar aberto: **1,10–2,26:1**.                                                                                        | Fechar diálogo praticamente invisível nos 6 temas.                                                      |
| **P0**     | `switch.tsx:12` — thumb `background` sobre trilho `input` desligado: **1,12–1,24:1**.                                                                                                  | Interruptor desligado parece inexistente.                                                               |
| **P0**     | `AppListView.tsx:404/409/424/429/431` — filhos `text-muted-foreground` não herdam o `hover:text-accent-foreground` do pai.                                                             | Texto some quando o item do menu recebe hover.                                                          |
| **P0**     | `EmuladoresPage.tsx:372` — `Badge variant="default"` com `bg-primary` + `text-{blue,emerald}-400` sobrescrevendo `primary-foreground`.                                                 | Azul/verde sobre dourado nos temas âmbar/batman.                                                        |
| **P1**     | **185 ocorrências** de cor Tailwind hardcoded em **13 de 17 páginas**.                                                                                                                 | Tema deixa de ser monotemático; `-400` claro fica ~1,5:1 no Paper.                                      |
| **P1**     | Glow azul `rgba(0,68,255,…)` em `button.tsx:13`, `card.tsx:10`, `NetworkPage.tsx:265/304`, `EmuladoresPage.tsx:43/49`, `ConfirmDialog.tsx:277`.                                        | Azul em temas dourado/verde/âmbar.                                                                      |
| **P2**     | **29** `transition-all`, **0** ocorrências de `prefers-reduced-motion`.                                                                                                                | Animações forçadas para quem pede redução de movimento.                                                 |
| **P2**     | **~34** strings visíveis com `...` em vez de `…`; spinners com rótulo estático.                                                                                                        | Tipografia inconsistente e loading sem feedback textual.                                                |

**Números:** 294 arquivos checados pelo Biome; 3 agentes de auditoria; 6 temas; 185 classes de cor hardcoded em páginas; 5 de 6 temas falham AA no `muted-foreground`.

---

## 2. Causa raiz do problema que você relatou

Os botões “Selecionar recomendados” (`DebloatPage.tsx:351`, `CleanerPage.tsx:492`) usam `variant="outline"` — que, **no papel**, é theme-aware:

```ts
// src/components/ui/button.tsx:17
outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent';
```

O problema está em quem define essas variáveis em runtime:

```ts
// src/contexts/SettingsContext.tsx:139-145
root.style.setProperty('--color-primary', `hsl(${h}, ${s}%, ${l}%)`);
root.style.setProperty('--color-primary-foreground', l > 60 ? '#0a0b10' : '#ffffff');
root.style.setProperty('--color-accent', `hsl(${h}, ${s + 10}%, ${l - 15}%)`);
root.style.setProperty('--color-accent-foreground', l > 60 ? '#0a0b10' : '#ffffff');
```

O foreground é decidido pela **luminosidade da cor de entrada**, não pela cor gerada — e o mesmo critério é usado para `primary` e `accent`, que têm luzes diferentes.

### Contrastes reais (padrão do app: `#22d3ee` → HSL 188°, 86%, 53%)

| Par                                        | Cor gerada | Foreground escolhido    | Contraste  | Resultado        |
| ------------------------------------------ | ---------- | ----------------------- | ---------- | ---------------- |
| `primary-foreground` / `primary`           | `#22d3ee`  | `#ffffff` (`l=53 ≤ 60`) | **1,81:1** | ❌ ilegível      |
| `primary-foreground` / `primary` (correto) | `#22d3ee`  | `#0a0b10`               | 10,88:1    | ✅               |
| `accent-foreground` / `accent` no hover    | `#0486be`  | `#ffffff`               | **4,07:1** | ❌ abaixo de 4,5 |
| `accent-foreground` / `accent` (correto)   | `#0486be`  | `#0a0b10`               | 4,83:1     | ✅               |

Outras cores do seletor confirmam a falha:

| `accentColor`        | Cor primária gerada | Texto escolhido | Contraste  |
| -------------------- | ------------------- | --------------- | ---------- |
| `#ffd91a` (amarelo)  | `hsl(50,100%,55%)`  | branco          | **1,38:1** |
| `#30e86e` (verde)    | `hsl(140,80%,55%)`  | branco          | **1,63:1** |
| `#f42525` (vermelho) | `hsl(0,90%,55%)`    | branco          | **4,09:1** |

**Correção:** calcular a luminância relativa (WCAG) de `--color-primary` **e** de `--color-accent` separadamente e escolher `#0a0b10` ou `#ffffff` pelo maior contraste (mínimo 4,5:1). Se nenhum dos dois atingir 4,5, ajustar a luminosidade da cor de fundo.

**Correção complementar para os dois botões:** o `bg-background` do `outline` abre um “buraco” da cor da página dentro do container `bg-card`. Trocar por um variant `subtle`:

```ts
subtle: 'border border-border bg-card/50 text-foreground hover:bg-muted hover:text-foreground';
```

Isso elimina a dependência do `accent` no hover e mantém o botão integrado ao card.

---

## 3. Contraste medido nos 6 temas

### Tokens padrão (WCAG 2.1 — alvo 4,5:1 texto / 3:1 não-texto)

| Tema                  | `muted` / `bg` | `muted` / `card` | `fg` / `card` | `primaryFg` / `primary` | `accentFg` / `accent` |
| --------------------- | -------------- | ---------------- | ------------- | ----------------------- | --------------------- |
| Paper (light)         | 5,40 ✅        | 6,05 ✅          | 16,80 ✅      | **3,74 ❌**             | 5,47 ✅               |
| Terminal (dark)       | **3,41 ❌**    | **3,08 ❌**      | 12,00 ✅      | 10,33 ✅                | 7,69 ✅               |
| Deep Space (midnight) | **2,97 ❌**    | **2,77 ❌**      | 11,09 ✅      | 7,20 ✅                 | **4,23 ❌**           |
| Amber                 | 4,59 ✅        | **4,15 ❌**      | 12,59 ✅      | 10,92 ✅                | 5,72 ✅               |
| Emerald               | 4,53 ✅        | **3,94 ❌**      | 12,81 ✅      | 9,33 ✅                 | 7,07 ✅               |
| Batman                | **2,88 ❌**    | **2,73 ❌**      | 13,82 ✅      | 8,33 ✅                 | 6,08 ✅               |

**`--color-muted-foreground` sugerido (≥4,5 em `card` + `background`):** Terminal `#77859c`, Midnight `#7c7c97`, Amber `#908474`, Emerald `#66947b`, Batman `#7e7c85`. (Se precisar também sobre `bg-muted`, use respectivamente `#8591a7`, `#83839d`, `#9a8f7f`, `#78a48c`, `#89868e`.)

### Cores Tailwind fixas sobre fundo claro Paper (`#fff`)

| Classe             | Hex       | Contraste  |
| ------------------ | --------- | ---------- |
| `text-amber-400`   | `#fbbf24` | **1,67:1** |
| `text-yellow-400`  | `#facc15` | **1,53:1** |
| `text-emerald-400` | `#34d399` | **1,92:1** |
| `text-green-400`   | `#4ade80` | **1,74:1** |
| `text-cyan-400`    | `#22d3ee` | **1,81:1** |
| `text-destructive` | `#f87171` | **2,77:1** |

As mesmas cores dão 6–12:1 nos temas escuros. Ou seja: o hexadecimal é legível em um tema e invisível em outro.

---

## 4. Achados P0 — corrigir primeiro

| #    | Arquivo:linha                                                       | Problema                                                                                                                                                               | Correção                                                                                           |
| ---- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P0-1 | `src/contexts/SettingsContext.tsx:139-145`                          | Foreground por limiar `l > 60`, sem WCAG; afeta `primary`, `accent`, sidebar e ring.                                                                                   | Calcular luminância real por cor gerada; escolher foreground com maior contraste.                  |
| P0-2 | `src/components/ui/dialog.tsx:45`                                   | `data-[state=open]:text-muted-foreground` + `bg-accent` + `opacity-70`: 1,10–2,26:1.                                                                                   | `data-[state=open]:text-accent-foreground`; remover `opacity-70` quando aberto.                    |
| P0-3 | `src/components/ui/switch.tsx:12`                                   | Thumb `bg-background` sobre trilho unchecked `bg-input`: 1,12–1,24:1 (alvo 3:1).                                                                                       | `data-[state=unchecked]:bg-muted-foreground` (ou `bg-foreground`).                                 |
| P0-4 | `src/pages/EmuladoresPage/AppListView.tsx:404,409,424,429,431`      | Pai tem `hover:bg-accent hover:text-accent-foreground`, mas `<p className="text-muted-foreground">` filho mantém cor própria no hover.                                 | Remover `text-muted-foreground` desses filhos ou usar `group-hover:text-accent-foreground`.        |
| P0-5 | `src/pages/EmuladoresPage.tsx:372`                                  | `<Badge variant="default" className={cn('text-[10px]', colors.text)}>`: `colors.text` sobrescreve `text-primary-foreground` sobre `bg-primary`.                        | Usar `Badge variant="outline"` com `style={{ color: 'var(--color-primary)' }}` ou token de status. |
| P0-6 | `src/components/ui/button.tsx:12-13`, `badge.tsx:11`, `tabs.tsx:60` | `hover:bg-primary/90` e `hover:bg-primary/80` mantêm `primary-foreground`: Paper cai para **3,25** e **2,85:1**; aba ativa `bg-primary/15 text-primary` dá **3,13:1**. | No Paper, escurecer `--color-primary` (ex.: `#0f766e`) ou usar `accent` no hover.                  |
| P0-7 | `DebloatPage.tsx:351`, `CleanerPage.tsx:492`                        | `variant="outline"` com `bg-background` dentro de card + hover dependente de `accent` (ver §2).                                                                        | Novo variant `subtle` com `border-border bg-card/50 hover:bg-muted hover:text-foreground`.         |

---

## 5. Achados P1 — tema e consistência de cores

### 5.1 Cores hardcoded nas páginas (185 ocorrências / 13 de 17 páginas)

| Padrão                                                                          | Qtd       | Concentração                                                         |
| ------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| `text-amber-400`                                                                | 25        | Startup (6), Cleaner (5), History (4), Debloat (3), Essentials (2)   |
| `text-emerald-400`                                                              | 15        | Network (4), History (3), Essentials (2), Startup (2), Dashboard (2) |
| `bg-amber-500/10`                                                               | 8         | History (3), Cleaner, Debloat, Essentials, Startup, RestorePoints    |
| `text-red-400`                                                                  | 7         | Cpu (3), History (2), Dashboard, Essentials                          |
| `text-yellow-400`                                                               | 7         | Cpu (4), InputLag (2), Network                                       |
| `bg-emerald-500/10`                                                             | 7         | Network (3), History (2), Emuladores, Essentials                     |
| `border-amber-500/20` + `bg-amber-500/5`                                        | 5 + 5     | Cleaner, Debloat, Essentials, Startup (par de aviso idêntico)        |
| `border-yellow-500/20` / `bg-yellow-500/10`                                     | 5 + 5     | Cpu, InputLag, Utilities, Network                                    |
| `border-emerald-500/30`                                                         | 5         | Network (4), Emuladores                                              |
| `text-orange-400` + `bg-orange-500/15` + `border-orange-500/30`                 | 5 + 3 + 4 | AppListView (3×), Network, Essentials                                |
| `text-amber-400/80`, `text-emerald-400/80`, `text-red-400/80`, `text-amber-300` | 4         | Essentials (3), Startup (1) — pior contraste no Paper                |

**Hot spots:**

- `EssentialsPage.tsx:38-88` — `PROGRAM_STYLES` com 9 paletas completas (27 classes). `cyan-400` colide com o primary do Terminal.
- `CpuPage.tsx:17-36` — 5 mapas `TONE_*` (15 classes) + hero amarelo em `142-145`.
- `NetworkPage.tsx:24-35,216` — latência em 4 cores fixas + único hero colorido fixo (`emerald`).
- `StartupPage.tsx:292-296,384,499,611,620,646,653,727-728` — aviso, badges “Admin”/“Protegido”, estados.
- `HistoryPage.tsx:68,84,89,96,207-234` — badges e cards de status.
- `InputLagPage.tsx:42-77,256,409,426,435,441` — 3 conjuntos de cor de dispositivo + marcador amarelo.
- `CleanerPage.tsx:318-323,459-461,592,599` — aviso admin e badges “Grande”/“Admin”.
- `EmuladoresPage/AppListView.tsx:514,588,682,693` — badges laranja e aviso âmbar.
- `DebloatPage.tsx:312-314,448` — aviso admin e badge “Protegido”.
- `RestorePointsPage.tsx:84-85,148` — aviso admin e marcador verde.

**Colisão semântica:** `amber-400 #fbbf24` **é** o primary do tema Amber; `emerald-400 #34d399` **é** o primary do Emerald; `cyan-400` ≈ primary do Terminal; `violet-400` ≈ primary do Midnight. O selo deixa de ser sinal e vira ruído.

**Direção:** status → `text-primary` / `text-destructive` / `text-muted-foreground` com `bg-*/10`; paletas categóricas → variáveis CSS derivadas de `--color-primary` via `color-mix()` (padrão já usado em `globals.css:322` para a scrollbar).

### 5.2 Glow RGB fixo

| Arquivo:linha                          | Valor                                      |
| -------------------------------------- | ------------------------------------------ |
| `src/components/ui/button.tsx:13`      | `rgba(0,68,255,0.4)`                       |
| `src/components/ui/button.tsx:15`      | `rgba(255,51,85,0.4)`                      |
| `src/components/ui/card.tsx:10`        | `rgba(0,68,255,0.15)`                      |
| `src/components/ConfirmDialog.tsx:277` | `rgba(0,68,255,…)`                         |
| `src/pages/NetworkPage.tsx:265,304`    | `rgba(0,68,255,0.3 / 0.5 / 0.15)`          |
| `src/pages/EmuladoresPage.tsx:43,49`   | `rgba(59,130,246,…)`, `rgba(16,185,129,…)` |

Substituir por `color-mix(in srgb, var(--color-primary) 40%, transparent)` e `var(--color-destructive)` para o vermelho.

### 5.3 Componentes base e sistema de temas

- `src/styles/globals.css:3` — `@custom-variant dark (&:is(.dark *))` reconhece só `.dark`; `midnight`/`amber`/`emerald`/`batman` não ativam utilities `dark:` (hoje 0 usos — risco latente). Incluir as 4 classes.
- `src/styles/globals.css:56-89` — `:root` (Paper) não declara `color-scheme: light`; controles nativos podem ficar escuros se o SO estiver em dark. Adicionar.
- `index.html:2` — `<html lang="pt-BR" class="dark">` fixo: flash do tema errado antes de `SettingsContext` aplicar a preferência salva. Aplicar tema antes do primeiro paint (script inline ou remover a classe padrão).
- `src/components/ui/badge.tsx:7` — `focus:outline-none focus:ring-*` em `<div>` não focável; ring nunca aparece. Remover ou tornar interativo.
- `src/components/ui/badge.tsx:11,15` — hovers `primary/80` (2,85 no Paper) e `destructive/80` (4,41–4,55, marginal).
- `src/components/ui/input.tsx:11` — `hover:border-primary/30` dá 1,41–2,07:1 (alvo 3:1); usar `/60` ou um ring.
- `src/components/ui/table.tsx:54` — `hover:border-l-2` insere 2px e desloca o conteúdo; declarar `border-l-2 border-l-transparent` por padrão. `primary/50` dá 1,79 no Paper; usar sem alpha.
- `src/components/ui/tabs.tsx:32` — `aria-label="Seções da inicialização"` fixo em componente reutilizável (usado também em `DebloatPage.tsx:346` para abas de apps). Virar prop `ariaLabel`.
- `src/layout/AppLayout.tsx:24,26` — `theme="system"` + `richColors` no Toaster: segue o tema do SO, não os 6 temas, e `toastOptions.style` não sobrescreve as cores dos botões close/action do Sonner. Derivar `theme` de `settings.theme` e mapear `--success-bg/--info-bg/--warning-bg/--error-bg`.
- `src/components/EnhancedToast.tsx:25-30` — `toast[type]` não define cor semântica; success/error/warning/info saem iguais, só o ícone muda.
- Dashboard/cards: `src/components/DashboardWidget.tsx:23-36,55-58,91-93` — paleta `emerald/amber/red` fixa e glow azul.
- `src/components/AutoCleanModal.tsx:126,261,266,286`, `ConfirmDialog.tsx:160-255`, `ScriptCard.tsx:29-34,49-107`, `ScriptBadge.tsx:32,47`, `ScriptSectionCard.tsx:86-87`, `VirtualizedSectionCard.tsx:153-154`, `NotificationsSection.tsx:10`, `PageLockSection.tsx:114`, `DataSection.tsx:10`, `UpdatesSection.tsx:79,110,159` — mesma família de cores fixas.

---

## 6. Achados P2 — acessibilidade, foco, movimento, tipografia

### Foco e semântica

- `src/components/CommandPalette.tsx:110` — `outline-none` **sem substituto**: foco invisível no campo de busca.
- `src/components/CommandPalette.tsx:99-100` — overlay `<div onClick>`; trocar por `<button aria-label="Fechar busca">` ou Radix Dialog.
- `src/components/CommandPalette.tsx:104-110` — input só com placeholder: adicionar `aria-label`, `role="combobox"`, `aria-expanded`, `aria-controls`; lista em `:116` com `role="listbox"`/`aria-activedescendant` e `aria-live` na contagem.
- `src/components/ui/tabs.tsx:41-76` — sem `focus-visible:ring-*`; `moveFocus()` (`:22-27`) só chama `onChange`, nunca `.focus()` no próximo botão — o foco visual fica na aba antiga.
- `src/components/ui/dialog.tsx:45` — usa `focus:` em vez de `focus-visible:` (ring aparece no clique do mouse).
- `src/layout/TitleBar.tsx:24-48`, `Sidebar.tsx:32,197-215`, `AutoCleanModal.tsx:99-109,160-303`, `PageLockSection.tsx:150-225`, `DataSection.tsx:18-25` — botões `<button>`/`select` sem `focus-visible:ring-*`.
- `src/components/settings/PageLockSection.tsx:20-26,140,145,165` — inputs de senha só com placeholder; adicionar `aria-label`.
- `src/components/settings/DataSection.tsx:26-38` — input de arquivo `className="hidden"`:<label> não é focável e o input `display:none` é inalcançável por teclado. Usar `sr-only` + `focus-within:ring` ou botão que chama `inputRef.click()`.
- `src/components/settings/UpdatesSection.tsx:72-74,194-203,214-223` — navegação externa com `<button onClick={window.open}>`; usar `<a href target="_blank" rel="noopener noreferrer">`.
- `src/components/AccentColorPicker.tsx:37` — `style={{ ringColor: color.hex }}` não é CSS válido para Tailwind; usar `--tw-ring-color`. Swatches também precisam de `aria-pressed` e foreground calculado (check `text-white` fixo em `:42` fica ~2:1 sobre amarelo).
- `src/components/ui/progress.tsx:10` — `ProgressPrimitive.Root` sem nome acessível; aceitar `ariaLabel`.
- `src/components/ErrorBoundary.tsx:31-33` — mensagem de erro sem `role="alert"`.

### Movimento

- Nenhuma ocorrência de `prefers-reduced-motion` / `motion-reduce:` em `src`.
- 29 usos de `transition-all`: `button.tsx:8`, `card.tsx:10`, `dialog.tsx:45`, `dashboard-widget`, `script-card`, `sidebar` (8), etc. Listar apenas as propriedades usadas.
- `animate-spin`, `animate-pulse`, `animate-in`, `zoom-*`, `slide-*`, `fade-*` sem `motion-reduce:animate-none` em `dialog.tsx:22,39`, `tooltip.tsx:21`, `skeleton.tsx:4`, `AutoCleanModal.tsx:73,363`, `UpdatesSection.tsx:99,141`, `Sidebar.tsx`, `CleanerPage.tsx`, etc.
- `globals.css:293-295` — transição de `background-color`/`color` no `body` sem opt-out.

### Diálogos e listas

- `ConfirmCleanDialog.tsx:37-43` — lista sem `max-h`/`overflow-y-auto` nem `overscroll-contain`; muitos itens estouram o modal.
- `ConfirmRemoveAppsDialog.tsx:33` — `overflow-y-auto` sem `overscroll-contain`; `:37` `truncate` sem `title` (familyName completo inacessível).
- `CommandPalette.tsx:116`, `Sidebar.tsx:151-155`, `AppLayout.tsx:48` — `overflow-y-auto` sem `overscroll-contain`.
- `ScriptCard.tsx:167` — fileira de badges sem `flex-wrap`; overflow com nomes longos.
- `ScriptCard.tsx:105-108`, `ScriptSectionCard.tsx:105-108`, `VirtualizedSectionCard.tsx:66,69`, `DashboardWidget.tsx:72-76` — `truncate`/`line-clamp` sem `title` e `min-w-0`.

### Tipografia e estados de carregamento

- ~34 strings visíveis com `...` em vez de `…`. Exemplos: `SettingsPage.tsx:44`, `UpdatesSection.tsx:89`, `EssentialsPage.tsx:166,168,169`, `NetworkPage.tsx:151,164,189,277`, `StartupPage.tsx:325`, `RestorePointsPage.tsx:157,170,180,181,202,368`, `AppListView.tsx:357,460,540,584,601,617`. Já corretos: `DebloatPage.tsx:342`, `DashboardPage.tsx:140`.
- Loading sem reticências: `EssentialsPage.tsx:171` (“aguarde”), `StartupPage.tsx:696,745,751` (spinner com rótulo estático “Parar”/“Desativar”).
- `AutoCleanModal.tsx:249-259` — status assíncrono sem `aria-live="polite"`.
- `AutoCleanModal.tsx:341` — `onBlur` cancela confirmação destrutiva ao navegar com Tab; exigir cancelamento explícito.
- `ConfirmDialog.tsx:121-134,218-261` — mudanças de fase e timer não anunciadas; `role="status" aria-live="polite"` no cabeçalho/resumo.

### Verificado OK

- `button.tsx:8`, `input.tsx:11`, `switch.tsx:12` — `focus-visible:outline-none` **com** `ring-2 ring-ring ring-offset-2`.
- `dialog.tsx:45-47` — botão de fechar nomeado por `<span class="sr-only">Fechar</span>`; ícones lucide já vêm com `aria-hidden`.
- Todos os usos de `<Toggle>` passam `id`, então o `Label htmlFor` está associado.
- `color-scheme: dark` presente nos 5 temas escuros (`globals.css:98`).
- Ícones decorativos dos botões novos (`Sparkles` em `DebloatPage.tsx:352` e `CleanerPage.tsx:493`) já têm `aria-hidden="true"`.

---

## 7. Plano de correção sugerido

### Fase 1 — legibilidade (P0)

1. `SettingsContext`: calcular contraste WCAG por cor gerada (primary e accent separadamente). **Critério:** para todos os swatches do `AccentColorPicker`, `primaryFg/primary ≥ 4,5` e `accentFg/accent ≥ 4,5`.
2. `dialog.tsx` e `switch.tsx`: trocar os pares de cor criticados.
3. `AppListView` e `EmuladoresPage:372`: parar de sobrescrever cor herdada/foreground.
4. `button.tsx`, `badge.tsx`, `tabs.tsx`: corrigir hover no Paper.
5. Botões de seleção: criar variant `subtle` e usar em `DebloatPage`/`CleanerPage`.
6. **Testes:** estender `SettingsContext.test.tsx` com varredura de todos os swatches e asserção de contraste ≥4,5; testes de render para dialog/switch não precisam de snapshot — verificar classes de token.

### Fase 2 — tokens de tema (P1)

1. Criar tokens semânticos em `globals.css`: `--color-success`, `--color-warning`, `--color-danger`/`--color-destructive`, `--color-info`, `--color-selection` — um valor por tema.
2. Substituir as 185 classes hardcoded por esses tokens ou por `color-mix()` a partir de `--color-primary`. Prioridade: `EssentialsPage` → `CpuPage` → `NetworkPage` → `StartupPage` → `HistoryPage`.
3. Substituir todos os glows RGB por `color-mix`.
4. Elevar `--color-muted-foreground` nos 5 temas escuros (tabela §3).
5. Escurecer `--color-primary` no Paper ou usar `accent` nos hovers de primary.
6. `SettingsContext`: passar a derivar `--accent-*` com a mesma função de contraste.
7. **Teste:** script de varredura que falhe se aparecer `text-(amber|emerald|yellow|red|cyan|violet|orange|blue|rose|green)-[0-9]{3}` em `src/**` (com exceção explícita dos tokens).

### Fase 3 — acessibilidade e foco (P2)

1. `CommandPalette` (overlay, combobox, foco), `tabs` (ariaLabel, refs, ring), `dialog` (`focus-visible`).
2. `aria-label` nos inputs de senha/arquivo, `aria-pressed` nos swatches, `aria-live` nos status dinâmicos.
3. `<a>` para links externos, `ariaLabel` no Progress, `role="alert"` no ErrorBoundary.
4. `overscroll-contain` em modais/listas e `max-h` no ConfirmCleanDialog.
5. `title` em texto truncado e `min-w-0` nos flex children.

### Fase 4 — polimento

1. Substituir `...` por `…` nas ~34 strings e padronizar reticências nos spinners.
2. `transition-all` → lista explícita de propriedades; `@media (prefers-reduced-motion: reduce)` global desligando animações e transições.
3. `color-scheme: light` no `:root`, `@custom-variant dark` com as 6 classes, remover `class="dark"` fixo do `index.html`.
4. Toaster: derivar tema das configurações e mapear cores semânticas.

**Gate ao final de cada fase:** `bun run lint && bun run typecheck && bun run test`, depois `bun run build`.

---

## Apêndice — páginas sem cor hardcoded

`SettingsPage.tsx`, `PrivacySecurityPage.tsx`, `PersonalizationPage.tsx`, `EmuladoresPage/InstanceSelectionModal.tsx`. São a referência a seguir: usam apenas `primary`/`accent`/`foreground`/`muted-foreground`.

**Ordem recomendada de ataque:** §2 (causa raiz) → P0-2/P0-3 (controles) → P0-4/P0-5 (hover/badge) → Fase 2 (tokens) → Fase 3 (foco) → Fase 4 (polimento).
