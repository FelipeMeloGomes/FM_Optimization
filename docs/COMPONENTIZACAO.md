# Análise de componentização — FM Optimize

Data: 26/11/2026  
Escopo lido: `src/pages/**`, `src/components/**`, `src/components/ui/**`, `src/hooks/**`, `src/lib/**`, `src/contexts/**`, `electron/main/**`, `scripts/**`, `AGENTS.md`.  
Este documento é um catálogo de referência: cada item traz evidências (arquivo e linha), proposta de API, risco e o teste que deve acompanhar a extração.

## 1. Infraestrutura que já existe — não recriar

| Já existe                              | Onde                                                                           | Uso correto                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `HeroBanner` / `HeroDescription`       | `src/components/hero/HeroBanner.tsx:10-90`                                     | Reutilizar em vez de reconstruir badge/título/descrição.                 |
| `PageSkeleton`                         | `src/components/PageSkeleton.tsx:5-62`                                         | Já cobre 17 layouts; não criar skeleton por página.                      |
| `EmptyState`                           | `src/components/ui/EmptyState.tsx:3-19`                                        | Estado vazio com ícone/título/descrição/ação.                            |
| `RefreshButton` / `PageRefreshBar`     | `src/components/RefreshButton.tsx:6-66`                                        | Único botão de atualização do app.                                       |
| `ScriptSelectionToolbar`               | `src/components/ScriptSelectionToolbar.tsx:5-126`                              | Barra de seleção de tweaks; o candidato é generalizá-la.                 |
| `VirtualizedScriptList`                | `src/components/VirtualizedScriptList.tsx:11-120`                              | Lista virtual de scripts já centralizada.                                |
| `useVirtualRows`                       | `src/hooks/use-virtual-rows.ts:17-97`                                          | Virtualização com scroll da página ou do contêiner.                      |
| `useScriptPage` / `useScriptSelection` | `src/hooks/use-script-page.ts:7-117`, `src/hooks/use-script-selection.ts:8-68` | Donos da lógica de catálogo, lote e seleção.                             |
| `TweaksPage`                           | `src/components/TweaksPage.tsx:22-184`                                         | Template completo das páginas de tweaks; não criar outro “PageTemplate”. |
| `ErrorBoundary`                        | `src/components/ErrorBoundary.tsx:14-47`                                       | Erro de render, não estado assíncrono de dados.                          |
| `SettingsPreviewLayout`                | `src/components/ui/SettingsPreviewLayout.tsx`                                  | Organiza preview + conteúdo nos painéis de ajustes.                      |

---

## 2. Prioridades

| Prioridade | Candidato                                         | Tipo           | Risco/esforço |
| ---------- | ------------------------------------------------- | -------------- | ------------- |
| P1         | `ErrorPanel`                                      | componente     | baixo–médio   |
| P1         | `toErrorMessage`                                  | util           | baixo         |
| P1         | `createJsonStore` / `writeJsonAtomic`             | util no main   | médio         |
| P1         | `parsePowerShellJson`                             | util no main   | baixo–médio   |
| P1         | `HeroBannerContent`                               | componente     | médio         |
| P1         | `BulkSelectionToolbar`                            | componente     | médio         |
| P1         | `useAdminStatus`                                  | hook           | médio         |
| P1         | `useBatchApply`                                   | helper interno | baixo         |
| P2         | `AdminNotice`                                     | componente     | baixo         |
| P2         | `useAsyncData` / `useLatestRequest`               | hook           | médio–alto    |
| P2         | `SettingsSectionShell`                            | componente     | baixo         |
| P2         | `SettingsPanelShell` / `SettingsApplyFooter`      | componente     | baixo–médio   |
| P2         | `VirtualSpacer` / `VirtualTableSpacer`            | componente     | baixo         |
| P2         | `formatDateTime`, `plural`, `formatUptimeCompact` | utils          | baixo         |
| P3         | `SearchInput`                                     | componente     | baixo         |
| P3         | `AsyncButton`                                     | componente     | baixo–médio   |
| P3         | `isIntegerInRange`                                | util no main   | baixo         |

---

## 3. Candidatos detalhados

### 3.1 `ErrorPanel` — estados de erro de carregamento/ação

**Evidências:** `src/components/TweaksPage.tsx:104-113`, `src/pages/DebloatPage.tsx:214-227` (e inline em `260-272`), `src/pages/CleanerPage.tsx:287-300` (e `420-432`), `src/pages/DashboardPage.tsx:95-105`, `src/pages/MeuPcPage.tsx:186-195`, `src/pages/StartupPage.tsx:173-185`, `src/pages/HistoryPage.tsx:156-163`, `src/pages/RestorePointsPage.tsx:103-111`, `src/pages/DevicePage.tsx:53-60`, `src/pages/EssentialsPage.tsx:241-251`, `src/pages/OptimizePcPage.tsx:239-251`, `src/components/keyboard/KeyboardSettingsPanel.tsx:21-30`, `src/components/mouse/MouseSettingsPanel.tsx:17-24`, `src/components/display/DisplaySettingsPanel.tsx:159-168`, `src/components/storage/StorageSettingsPanel.tsx:166-176`.

**Comportamento comum:** título descritivo, mensagem em `text-destructive`, botão opcional “Tentar novamente” e `role="alert"`.

```tsx
type ErrorPanelVariant = 'full' | 'inline' | 'card';

interface ErrorPanelProps {
  variant?: ErrorPanelVariant;
  title: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
}
```

**Risco:** baixo–médio (manter as três variantes visuais). `EmptyState` cobre vazio, `ErrorBoundary` cobre render; nenhum cobre falha de IPC. Centralizar melhora acessibilidade — hoje nem todo erro usa `role="alert"`.

**Teste:** renderizar cada variante, conferir `role="alert"`, texto da mensagem, presença/ausência do botão e classes de tema (`text-destructive`, `border-destructive/20`).

---

### 3.2 `toErrorMessage` — normalização de `unknown`

**Evidências:** `src/pages/DebloatPage.tsx:21-24`, `src/pages/CleanerPage.tsx:80-83`, `src/pages/OptimizePcPage.tsx:52-54`, `src/pages/CompararPlacaPage.tsx:350-354`, `src/pages/OverlayJogoPage.tsx:499-500`, `src/hooks/use-appx-inventory.ts:4-7`, `src/hooks/use-cleaner-items.ts:47-50`, `src/hooks/use-storage-drives.ts:21-23`, `src/hooks/use-startup.ts:10-14`, `src/hooks/use-essentials.ts:11-15`, `src/hooks/use-display-settings.ts:25-27`, `src/hooks/use-keyboard-settings.ts:21-23`, `src/hooks/use-mouse-settings.ts:19-21`; main: `electron/main/services/optimization.ts:251-256`, `electron/main/services/presentmon.ts:126-128`.

```ts
// electron/shared/errors.ts — renderer e main importam o mesmo
export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
```

**Risco:** baixo, mudança quase mecânica. Alguns arquivos não tratam `string` explicitamente; a versão acima é a mais completa.

**Teste:** `Error`, `string`, `null`, `undefined`, objeto comum.

---

### 3.3 `createJsonStore` / `writeJsonAtomic` — JSON no main

**Evidências:** `electron/main/services/overlay-storage.ts:25-46`, `single-instance.ts:22-46`, `removed-apps.ts:27-53`, `startup-overrides.ts:26-52`, `system-info-cache.ts:9-48`, `gpu-catalog.ts:87-94` e `120-135`, `data-service.ts:70-80`, `131-136`, `282-286`.

**Padrão:** resolver caminho em `%APPDATA%\fm-optimize`/`userData`, garantir diretório, `existsSync → fallback`, `JSON.parse` em `try/catch`, escrita em `<arquivo>.tmp` + `renameSync`.

```ts
// electron/main/utils/json-store.ts
interface JsonStoreOptions<T> {
  path: string;
  fallback: T;
  validate?: (value: unknown) => value is T;
  ensureDir?: boolean;
  pretty?: boolean;
  onCorrupt?: (path: string, error: unknown) => void;
}

export function createJsonStore<T>(options: JsonStoreOptions<T>): {
  read(): T;
  write(value: T): void;
};

export function writeJsonAtomic(
  path: string,
  value: unknown,
  options?: { pretty?: boolean; ensureDir?: boolean }
): void;
```

**Risco:** médio. Cada serviço tem política própria: `data-service.ts:96-99` faz backup de arquivo corrompido, `gpu-catalog.ts` valida com Zod, `single-instance.ts` exige objeto. A API precisa aceitar `validate` e `onCorrupt` sem engessar.

**Teste:** arquivo inexistente → fallback; JSON corrompido → `onCorrupt`; escrita não deixa `.tmp`; leitura após escrita devolve o valor; diretório criado quando `ensureDir`.

---

### 3.4 `parsePowerShellJson` — parse de saída do PowerShell

**Evidências:** `electron/main/services/display-settings.ts:152-158`, `mouse-settings.ts:85-93`, `keyboard-settings.ts:81-89`, `appx-inventory.ts:125-141`, `gpu-info.ts:29-37`.

```ts
export function parsePowerShellJson(
  raw: string,
  options: {
    label: string;
    emptyFallback?: unknown;
    onInvalid?: (raw: string) => unknown;
  }
): unknown;

// parsePowerShellJson(raw, { label: 'configurações do mouse' })
// → "Não foi possível ler as configurações do mouse: resposta inválida"
```

**Risco:** baixo–médio. `gpu-info.ts` prefere `[]` no inválido; os settings lançam erro. Manter as duas políticas via opção.

**Teste:** vazio → fallback; JSON válido → objeto; inválido → erro com `label` ou `onInvalid`.

---

### 3.5 `HeroBannerContent` — corpo textual do banner

**Evidências:** implementação padrão já em `src/components/hero/HeroBanner.tsx:76-85`; reproduções manuais em `src/pages/DebloatPage.tsx:238-251`, `CleanerPage.tsx:374-389`, `StartupPage.tsx:239-250`, `HistoryPage.tsx:168-181`, `RestorePointsPage.tsx:117-137`, `SettingsPage.tsx:14-33`; helpers locais idênticos em `CompararPlacaPage.tsx:278-280` e `OverlayJogoPage.tsx:463-465`.

```tsx
interface HeroBannerContentProps {
  badge?: string;
  path?: string;
  title: string;
  description: string;
  size?: 'md' | 'lg';
  trailing?: ReactNode;
  className?: string;
  titleClassName?: string;
}
```

**Risco:** médio (visual). Na prática, a primeira escolha é **remover os `children` duplicados** e usar o que o próprio `HeroBanner` já renderiza; só vale criar o wrapper quando houver `trailing` ou `size` diferente.

**Teste:** badge com `RouteIcon`, `h2` com o título, descrição presente, classes de tema e ausência de cores fixas (`AGENTS.md:41-45`).

---

### 3.6 `BulkSelectionToolbar` — generalização da barra de seleção

**Evidências:** `src/components/ScriptSelectionToolbar.tsx:50-78` e `105-122`, `src/pages/DebloatPage.tsx:317-347`, `src/pages/CleanerPage.tsx:452-497`, `src/components/storage/StorageSettingsPanel.tsx:198-207`.

**Padrão:** card horizontal, selecionar todos/limpar, contador `tabular-nums`, ação desabilitada quando nada selecionado, estado “processando…”.

```tsx
interface BulkSelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  allSelected?: boolean;
  onSelectAll?: () => void;
  onClear?: () => void;
  onApply: () => void;
  applyLabel: string;
  applyingLabel?: string;
  applying?: boolean;
  disabled?: boolean;
  progress?: { index: number; total: number } | null;
  failures?: Array<{ id: string; label: string }>;
  onDismissFailures?: () => void;
  leading?: ReactNode;
  trailingInfo?: ReactNode;
}
```

`ScriptSelectionToolbar` vira wrapper fino que converte `ScriptEntry[]` para essa API. Ações extras (“Selecionar recomendados”, busca/tabs) ficam em `leading`, não na lógica da barra.

**Teste:** contador, botão desabilitado com zero selecionado, rótulo durante `applying`, falhas e callback de dismiss.

---

### 3.7 `useAdminStatus` — estado e elevação

**Evidências:** `src/pages/DebloatPage.tsx:193-208`, `OptimizePcPage.tsx:69-93` e `156-170`, `CleanerPage.tsx:101-102`, `117-130`, `434-450`, `src/hooks/use-startup.ts:123-133`, `src/contexts/RestorePointContext.tsx:28-41`, `src/contexts/AutoCleanContext.tsx:117-142`.

```ts
export function useAdminStatus(options?: {
  initial?: boolean | null;
  fetch?: boolean;
  onError?: (error: unknown) => void;
}): {
  isAdmin: boolean | null;
  elevating: boolean;
  relaunchAsAdmin: () => Promise<boolean>;
};
```

**Risco:** médio. Algumas páginas já recebem `elevated` no payload; `initial` evita segunda chamada IPC.

**Teste:** estado inicial vindo do payload, sucesso/falha de elevação, `elevating` durante a chamada.

---

### 3.8 `useBatchApply` — duplicação dentro de `useScriptPage`

**Evidências:** `src/hooks/use-script-page.ts:65-73` e `82-90` (`handleApply` e `handleConfirmBulk` repetem `executeBatch` + preenchimento de `failedScripts`).

```ts
const runBatch = useCallback(
  (scripts: ScriptEntry[]) => {
    void executeBatch(scripts).then(
      ({ failedIds }) => setFailedScripts(scripts.filter((s) => failedIds.includes(s.id))),
      (error) => {
        setFailedScripts([...scripts]);
        console.error('Falha ao aplicar o lote de scripts:', error);
      }
    );
  },
  [executeBatch]
);
```

**Risco:** baixo, refactor local com cobertura indireta via `TweaksPage`.

**Teste:** lote com falhas parciais → só os ids retornados marcados; rejeição → todos marcados como falha.

---

### 3.9 `useAsyncData` / `useLatestRequest` — respostas obsoletas

**Evidências:** `src/hooks/use-essentials.ts:26-53` (`requestId`), `use-startup.ts:20-45` (idêntico), `src/contexts/ScriptContext.tsx:31-50` (`requestRef`), `use-appx-inventory.ts:23-46` (`cancelled`), `use-cleaner-items.ts:65-89` (`cancelled`).

```ts
export function useLatestRequest(): {
  next(): number;
  isCurrent(request: number): boolean;
  invalidate(): void;
};

// versão mais completa
export function useAsyncData<T>(
  loader: () => Promise<T>,
  options?: {
    autoLoad?: boolean;
    onSuccess?: (data: T) => void;
  }
): {
  state: AsyncState<T>;
  reload: () => void;
  setData: (updater: (current: T) => T) => void;
};
```

**Risco:** médio–alto. `useAppxInventory` e `useCleanerItems` também guardam `isRefreshing`/`lastRefreshed`; pode ser necessário dividir em dois hooks.

**Teste:** duas cargas rápidas → só a última atualiza o estado; desmontagem durante a promise → sem `setState` e sem aviso do React.

---

### 3.10 `SettingsSectionShell` — seções da página Configurações

**Evidências:** `src/components/settings/ThemeSection.tsx:5-29`, `PreferencesSection.tsx:4-44`, `NotificationsSection.tsx:4-50`, `DataSection.tsx:4-43`, `PageLockSection.tsx:112-239`, `UpdatesSection.tsx:72-215`.

```tsx
type SettingsTone = 'primary' | 'warning' | 'info' | 'success';

interface SettingsSectionProps {
  title: string;
  tone: SettingsTone;
  variant?: 'rows' | 'panel';
  children: ReactNode;
}
```

**Risco:** baixo. Testar cor do dot (`bg-*`) e estrutura do card, conforme `AGENTS.md:41-45`.

---

### 3.11 `SettingsPanelShell` / `SettingsApplyFooter`

**Evidências:** `src/components/keyboard/KeyboardSettingsPanel.tsx:36-43`, `53-79`; `mouse/MouseSettingsPanel.tsx:30-37`, `46-72`; `display/DisplaySettingsPanel.tsx:174-181`; `storage/StorageSettingsPanel.tsx:189-196`; rodapés em `DisplaySettingsPanel.tsx:203-205` e `StorageSettingsPanel.tsx:227-229`.

```tsx
interface SettingsPanelShellProps {
  title?: string;
  badge: string;
  note?: string;
  children: ReactNode;
  footer?: ReactNode;
}

interface SettingsApplyFooterProps {
  isDirty: boolean;
  onApply: () => void;
  onRestoreDefault: () => void;
  onDiscard: () => void;
  onFillDefaults?: () => void;
  appliedAt?: string | null;
  applyError?: string | null;
}
```

**Risco:** baixo para o shell; médio para unificar o footer (`fillDefaults` não existe em mouse/display).

---

### 3.12 `VirtualSpacer` / `VirtualTableSpacer`

**Evidências:** `src/components/VirtualizedScriptList.tsx:48-50`, `128-130`; `src/pages/CleanerPage.tsx:503-509`, `607-613`; `DebloatPage.tsx:361-367`, `462-468`; `StartupPage.tsx:331-335`, `402-406`, `437-441`, `515-519`, `551-555`, `671-675`; `HistoryPage.tsx:255-259`, `271-275`.

```tsx
function VirtualSpacer({ height, testId }: { height: number; testId?: string }): JSX.Element;
function VirtualTableSpacer({ height, colSpan }: { height: number; colSpan: number }): JSX.Element;
```

**Risco:** baixo. Preservar `data-testid="virtual-spacer-top/bottom"`. `useVirtualRows` já devolve `paddingTop/paddingBottom`.

---

### 3.13 Utils de formatação

**Evidências:** `formatDate` em `HistoryPage.tsx:30-32` e `RestorePointsPage.tsx:35-37`; `plural` em `DebloatPage.tsx:26-27` (`153`, `163`, `326`) com ternários equivalentes em `ConfirmBulkScriptDialog.tsx:21-43`, `ConfirmRemoveAppsDialog.tsx:28`, `MeuPcPage.tsx:376`, `489`, `CommandPalette.tsx:134`; `formatUptime` em `DashboardPage.tsx:20-27` e `MeuPcPage.tsx:53-65`.

Extender `src/utils/format.ts:1-23`:

```ts
export function formatDateTime(value: string | number | Date): string;
export function plural(count: number, singular: string, pluralForm: string): string;
export function formatUptimeCompact(seconds: number): string;
export function formatUptimeLong(seconds: number): string;
export function formatElapsedMs(milliseconds: number): string;
```

**Atenção:** não sobrescrever `formatDuration` existente (`src/utils/format.ts:9-15` usa segundos e prefixo `~`). O equivalente de `HistoryPage.tsx:34-40` usa milissegundos e não tem prefixo — daí o nome `formatElapsedMs`.

**Teste:** valores pt-BR, singular/plural, zero, 1, >1, dias/horas/minutos. Já existe `src/utils/format.test.ts`.

---

### 3.14 `SearchInput`

**Evidências:** `src/pages/DebloatPage.tsx:295-307`, `StartupPage.tsx:284-294`, `EmuladoresPage/AppListView.tsx:350-359`, `src/components/CommandPalette.tsx:112-128`.

```tsx
interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ariaLabel: string;
  compact?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}
```

**Risco:** baixo. `CommandPalette` precisa de ref e `role="combobox"`, então o wrapper deve repassar props HTML.

---

### 3.15 `AsyncButton`

**Evidências:** `src/pages/CleanerPage.tsx:478-495`, `DebloatPage.tsx:329-345`, `src/components/ScriptSelectionToolbar.tsx:105-122`, `StartupPage.tsx:704-712`, `OptimizePcPage.tsx:389-396`.

```tsx
interface AsyncButtonProps extends Omit<ButtonProps, 'children'> {
  loading: boolean;
  loadingLabel: string;
  busyIcon?: ReactNode;
  children: ReactNode;
}
```

**Risco:** baixo–médio. Ícones/tamanhos variam; aceitar `children` como conteúdo completo. **Não** usar para refresh — `RefreshButton` já resolve esse caso.

---

### 3.16 `AdminNotice` — aviso inline de administrador

**Evidências:** `src/pages/CleanerPage.tsx:117-130` e `435-450`, `OptimizePcPage.tsx:156-170`, `src/hooks/use-startup.ts:123-133`. O caso de `RestorePointsPage.tsx:78-101` é diferente (painel cheio com instrução específica) e deve continuar separado.

```tsx
interface AdminNoticeProps {
  message: ReactNode;
  onRelaunch?: () => void;
  relaunching?: boolean;
  compact?: boolean;
}
```

**Risco:** baixo. Usar `border-warning/20 bg-warning/5` (tokens já presentes em `CleanerPage.tsx:307` e `435`).

---

### 3.17 `isIntegerInRange` — validação numérica no main

**Evidências:** `electron/main/services/mouse-settings.ts:81-83`, `keyboard-settings.ts:49-51`, `display-settings.ts:116`, `122`.

```ts
export function isIntegerInRange(value: unknown, min: number, max: number): value is number;

export function isInRange(value: number, min: number, max: number): boolean;
```

**Risco:** baixo. Só vale se o módulo de utils do main estiver sendo criado para JSON/erros de qualquer forma.

---

## 4. O que NÃO componentizar

### 4.1 Template de tweaks já resolvido

`src/components/TweaksPage.tsx:22-184` já absorveu hero, toolbar, lista virtualizada, seleção, confirmação em lote, loading/erro e `beforeContent`. Páginas de CPU, GPU, rede, armazenamento, privacidade e personalização não devem ganhar outro wrapper.

### 4.2 Helpers de uma única página

| Padrão                                              | Evidência                                          | Motivo                                                             |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `getLatencyColor` / `getLatencyBg`                  | `src/pages/DnsPage.tsx:13-25`                      | Específico do DNS.                                                 |
| `getCpuStatus`, `getMemoryStatus`, `getDriveStatus` | `src/pages/DashboardPage.tsx:29-48`                | Regras de negócio do dashboard, sem segundo consumidor.            |
| `formatNumber`                                      | `src/pages/CompararPlacaPage.tsx:44`               | Catálogo de GPUs.                                                  |
| `formatInstallDate`                                 | `src/pages/MeuPcPage.tsx:67-73`                    | WMI `/Date(...)` + UTC; não é `formatDateTime`.                    |
| `formatTimeSince`                                   | `src/pages/CleanerPage.tsx:65-78`                  | Diferente de `formatNextRun` (`src/lib/cleaner-options.ts:54-70`). |
| Hotkeys do overlay                                  | `src/pages/OverlayJogoPage.tsx:40-90`              | Domínio do overlay.                                                |
| Presets/bloatware ADB                               | `src/pages/EmuladoresPage/AppListView.tsx:361-420` | Especialidade da lista de apps.                                    |
| Plano/análise de otimização                         | `src/pages/OptimizePcPage.tsx:56-170`              | Fluxo de negócio próprio.                                          |
| Aviso de admin dos Restore Points                   | `src/pages/RestorePointsPage.tsx:78-101`           | Painel cheio, não o aviso inline.                                  |
| `isValidScriptId`                                   | `electron/main/index.ts:79-90`                     | Validação de fronteira IPC; sem duplicata.                         |

### 4.3 Migrar, não extrair

- `src/pages/DebloatPage.tsx:350-355` — estado vazio manual → usar `EmptyState`.
- `src/pages/CompararPlacaPage.tsx:278-280` e `OverlayJogoPage.tsx:463-465` — `PageContent` de 3 linhas → absorver em `HeroBannerContent`/`contentClassName`.
- Botões de refresh espalhados → `RefreshButton`/`PageRefreshBar`.

### 4.4 Testes que não devem virar helpers de produção

Vários testes leem `resources/scripts.json` diretamente, por exemplo `electron/main/tests/script-catalog.test.ts:21`, `script-content.test.ts:22`, `optimization-plan.test.ts:8-9`. Isso é intencional conforme `AGENTS.md:32`: o teste precisa provar a fiação com o catálogo real. Não extrair para helper que esconda o arquivo lido.

---

## 5. Ordem sugerida de implementação

1. `toErrorMessage` + `ErrorPanel` + `AdminNotice` — ganho alto, risco baixo.
2. `createJsonStore` + `parsePowerShellJson` no main — remove duplicação estrutural de persistência.
3. `HeroBannerContent` + `BulkSelectionToolbar` + `useBatchApply` — reduz bastante código das páginas sem mexer na regra de negócio.
4. `useAdminStatus` e `useAsyncData` — com testes de regressão de concorrência/desmontagem.
5. Utils de formatação, `VirtualSpacer`, `SearchInput`, `Settings*Shell`, `AsyncButton`, `isIntegerInRange` — limpeza final.

Checklist por extração (conforme `AGENTS.md`):

- [ ] teste cobrindo comportamento real (não reimplementação do código);
- [ ] estado de carregamento/erro/vazio quando aplicável;
- [ ] tokens do tema nas classes (`bg-primary`, `text-primary`, `border-border`, `text-destructive`, `bg-warning/5`), sem cores fixas;
- [ ] `bun run lint && bun run typecheck && bun run test` verde antes do commit;
- [ ] `README.md` atualizado se houver mudança visível ao usuário.
