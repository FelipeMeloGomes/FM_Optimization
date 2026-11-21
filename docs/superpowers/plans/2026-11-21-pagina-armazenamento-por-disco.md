# Página Armazenamento por disco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a página Armazenamento no padrão do Monitor — um card por disco com uso/tipo, seleção, limpeza do Windows e otimização SSD — mantendo os tweaks atuais e trocando o hero pelo padrão visual de Mouse, Monitor e Teclado (foto de HD/SSD).

**Architecture:** A leitura reaproveita `useSystemContext()` (o mesmo cache do Início); apenas as ações por unidade são novas: dois canais IPC validates letter + service que abre `cleanmgr /d X:` ou `defrag X: /O /L` em janela visível. Um hook de renderer mantém seleção/estado das ações, e um painel com `SettingsPreviewLayout` monta os cards via prop passiva nova no `TweaksPage`.

**Tech Stack:** Electron + TypeScript, React 19, Tailwind CSS 4, electron-vite, bun, Biome, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-11-21-pagina-armazenamento-por-disco-design.md`

## Global Constraints

- Gate antes de commit: `bun run lint && bun run typecheck && bun run test`.
- Todo código novo precisa de teste que cubra o comportamento real; correção de bug precisa de teste de regressão.
- Sem novas dependências. Usar `Button`, `SettingsPreviewLayout`, `AnimatedNumber` do barrel `src/components/ui`.
- Letras de unidade são sempre normalizadas para maiúsculas no renderer e validadas por `^[A-Za-z]$` no main.
- Não alterar `scripts.json`, o runner de scripts, a navegação nem o filtro `hasSSD` da página. O hero é substituído na Task 6, sem mudar badge, título ou descrição.
- `.env.local` nunca é commitado.
- A edição pendente no `README.md` (ordem da barra lateral: Meu PC, Monitor, Mouse, Teclado) entra na Task 5.

## Review Focus

- Letra malformada vinda do renderer (`C:`, `C:\\`, `../../C`) — deve ser rejeitada antes de virar comando; teste na Task 1 (`buildDriveActionCommand`) e Task 2 (`IpcSchemas`).
- App sem privilégio administrativo — deve falhar com a mensagem já existente no `script-executor`, sem relançar em UAC; teste na Task 1 (`runDriveAction`).
- HD selecionado — não pode exibir TRIM nem botão "Otimizar SSD"; teste na Task 4.
- `drives: []` por falha engolida no WMI — deve mostrar estado vazio com "Tentar novamente", nunca dados falsos; teste na Task 4.
- Catálogo de tweaks em `loading`/`error` — o painel de discos continua visível e independente; teste na Task 5.

---

### Task 1: Serviço de ações por unidade no main

**Files:**

- Create: `electron/main/services/drive-actions.ts`
- Test: `electron/main/services/drive-actions.test.ts`

**Interfaces:**

- Consumes: `INTERACTIVE_WRAPPER_COMMAND` de `./script-commands`; `isAdmin` de `./admin-check`; `spawn` de `node:child_process`.
- Produces:
  - `export type DriveActionKind = 'cleanup' | 'optimize'`
  - `export const DRIVE_LETTER_PATTERN: RegExp` (`/^[A-Za-z]$/`)
  - `export function buildDriveActionCommand(kind: DriveActionKind, letter: string): { command: string; args: string[]; env: Record<string, string> }`
  - `export function runDriveAction(kind: DriveActionKind, letter: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDriveActionCommand, DRIVE_LETTER_PATTERN, runDriveAction } from './drive-actions';

it('monta o cleanmgr para a unidade informada', () => {
  const launch = buildDriveActionCommand('cleanup', 'c');
  expect(launch.command).toBe('powershell.exe');
  expect(launch.args).toEqual(['-NoProfile', '-Command', expect.any(String)]);
  expect(launch.env.FMOPT_CHILD_EXE).toBe('cmd.exe');
  expect(launch.env.FMOPT_CHILD_ARGS).toBe('/c cleanmgr /d C:');
});

it('monta o defrag com /O /L na unidade informada', () => {
  expect(buildDriveActionCommand('optimize', 'D').env.FMOPT_CHILD_ARGS).toBe('/c defrag D: /O /L');
});

it('rejeita letra que não é uma única letra', () => {
  for (const bad of ['C:', 'C:\\', '', 'CC', '../C']) {
    expect(() => buildDriveActionCommand('cleanup', bad)).toThrow('Unidade inválida');
    expect(DRIVE_LETTER_PATTERN.test(bad)).toBe(false);
  }
});

it('exige administrador antes de lançar o processo', async () => {
  vi.mock('./admin-check', () => ({ isAdmin: () => false }));
  await expect(runDriveAction('cleanup', 'C')).rejects.toThrow(
    'Este script requer privilégios de administrador. Execute o programa como administrador.'
  );
});

it('só resolve quando o processo filho fecha', async () => {
  // mock de child_process.spawn com EventEmitter: capturar o callback 'close'
  const promise = runDriveAction('optimize', 'C');
  let resolved = false;
  void promise.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  proc.emit('close', 0);
  await expect(promise).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run electron/main/services/drive-actions.test.ts --reporter=verbose`
Expected: FAIL — módulo `./drive-actions` não existe.

- [ ] **Step 3: Implement `drive-actions.ts`**

`buildDriveActionCommand` valida com `DRIVE_LETTER_PATTERN`, normaliza com `toUpperCase()` e devolve o mesmo formato de `buildInteractiveLaunch`: `command: 'powershell.exe'`, `args: ['-NoProfile','-Command', INTERACTIVE_WRAPPER_COMMAND]`, `env` com `FMOPT_CHILD_EXE: 'cmd.exe'` e `FMOPT_CHILD_ARGS` igual a `/c cleanmgr /d <letra>:` ou `/c defrag <letra>: /O /L`. `runDriveAction` chama `isAdmin()` e lança a mensagem exata acima quando falso; depois faz `spawn(command, args, { windowsHide: true, stdio: 'ignore', env: { ...process.env, ...env } })` e devolve uma Promise que resolve no evento `close` e rejeita no evento `error`. Sem timeout, sem histórico, sem ponto de restauração.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run electron/main/services/drive-actions.test.ts --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/drive-actions.ts electron/main/services/drive-actions.test.ts
git commit -m "feat(storage): adiciona acoes de disco por unidade no main"
```

---

### Task 2: Expor os dois canais IPC

**Files:**

- Modify: `electron/shared/ipc-types.ts:533` (interface `ElectronAPI`)
- Modify: `electron/main/validation.ts:266` (`IpcSchemas`)
- Modify: `electron/main/ipc-handlers.ts:205` (registro de handlers)
- Modify: `electron/preload/index.ts:171` (objeto `electronAPI`)
- Test: `electron/main/tests/validation.test.ts`

**Interfaces:**

- Consumes: `DRIVE_LETTER_PATTERN`, `runDriveAction` da Task 1.
- Produces: `window.electronAPI.runDiskCleanup(letter: string): Promise<void>` → canal `'storage:clean-drive'`; `window.electronAPI.optimizeDrive(letter: string): Promise<void>` → canal `'storage:optimize-drive'`. Ambos com schema `z.string().regex(DRIVE_LETTER_PATTERN)`.

- [ ] **Step 1: Write the failing test**

```ts
it('valida letra de unidade para as acoes de armazenamento', () => {
  for (const channel of ['storage:clean-drive', 'storage:optimize-drive']) {
    expect(IpcSchemas[channel].safeParse('C').success).toBe(true);
    expect(IpcSchemas[channel].safeParse('d').success).toBe(true);
    for (const bad of ['C:', 'C:\\', '', 'CC']) {
      expect(IpcSchemas[channel].safeParse(bad).success).toBe(false);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run electron/main/tests/validation.test.ts --reporter=dot`
Expected: FAIL — `IpcSchemas['storage:clean-drive']` é `undefined`.

- [ ] **Step 3: Wire os canais**

Adicionar os dois métodos em `ElectronAPI`, os dois `ipcMain.handle` usando `handleIpc(channel, raw, (validated) => runDriveAction('cleanup' | 'optimize', validated as string))`, as duas entradas em `IpcSchemas` com `DriveLetterSchema`, e os dois métodos no preload via `ipcVoid`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run electron/main/tests/validation.test.ts --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/shared/ipc-types.ts electron/main/validation.ts electron/main/ipc-handlers.ts electron/preload/index.ts electron/main/tests/validation.test.ts
git commit -m "feat(storage): expoe canais IPC de limpeza e otimizacao por disco"
```

---

### Task 3: Hook `useStorageDrives`

**Files:**

- Create: `src/hooks/use-storage-drives.ts`
- Test: `src/hooks/use-storage-drives.test.ts`

**Interfaces:**

- Consumes: `useSystemContext()` (`{ state, refresh, hasFetched }`), `StorageDrive`/`DashboardData`/`AsyncState` de `electron/shared/ipc-types`, API da Task 2.
- Produces:

```ts
export interface UseStorageDrivesResult {
  state: AsyncState<DashboardData>;
  drives: StorageDrive[];
  selected: Set<string>;
  optimizeFlags: Set<string>;
  busy: Set<string>;
  errors: Record<string, string>;
  applied: Record<string, boolean>;
  refresh: () => void;
  toggleSelected: (letter: string) => void;
  toggleOptimize: (letter: string) => void;
  cleanup: (letter: string) => Promise<void>;
  optimize: (letter: string) => Promise<void>;
  cleanupSelected: () => Promise<void>;
}
export function useStorageDrives(): UseStorageDrivesResult;
```

- [ ] **Step 1: Write the failing test**

```ts
// mock de ../contexts/SystemContext com store.system = { status:'success', data:{ drives:[...] } },
// store.hasFetched e store.refresh = vi.fn(); API em window.electronAPI com vi.fn().
it('atualiza o contexto na montagem quando ainda nao houve leitura', () => {
  store.hasFetched = false;
  renderHook(() => useStorageDrives());
  expect(store.refresh).toHaveBeenCalledTimes(1);
});

it('seleciona e marca otimizacao por letra', () => {
  const { result } = renderHook(() => useStorageDrives());
  act(() => result.current.toggleSelected('c:'));
  expect(result.current.selected.has('C:')).toBe(true);
  act(() => result.current.toggleOptimize('C:'));
  expect(result.current.optimizeFlags.has('C:')).toBe(true);
  act(() => result.current.toggleSelected('C:'));
  expect(result.current.selected.has('C:')).toBe(false);
});

it('chama a API com a letra, marca ocupado e registra sucesso', async () => {
  let resolve!: () => void;
  api.runDiskCleanup.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      })
  );
  const { result } = renderHook(() => useStorageDrives());
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.cleanup('C:');
  });
  expect(result.current.busy.has('C:')).toBe(true);
  resolve();
  await act(async () => {
    await pending;
  });
  expect(api.runDiskCleanup).toHaveBeenCalledWith('C:');
  expect(result.current.applied['C:']).toBe(true);
  expect(result.current.busy.has('C:')).toBe(false);
  expect(store.refresh).toHaveBeenCalled();
});

it('registra erro por unidade e nao derruba o hook', async () => {
  api.optimizeDrive.mockRejectedValue(new Error('acesso negado'));
  const { result } = renderHook(() => useStorageDrives());
  await act(async () => {
    await result.current.optimize('D:');
  });
  expect(result.current.errors['D:']).toBe('acesso negado');
});

it('no lote limpa todas as selecionadas e otimiza so as SSDs sinalizadas', async () => {
  // drives: C: type 'SSD', D: type 'HD'
  const { result } = renderHook(() => useStorageDrives());
  act(() => {
    result.current.toggleSelected('C:');
    result.current.toggleSelected('D:');
    result.current.toggleOptimize('C:');
    result.current.toggleOptimize('D:');
  });
  await act(async () => {
    await result.current.cleanupSelected();
  });
  expect(api.runDiskCleanup.mock.calls.map((c) => c[0])).toEqual(['C:', 'D:']);
  expect(api.optimizeDrive.mock.calls.map((c) => c[0])).toEqual(['C:']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/hooks/use-storage-drives.test.ts --reporter=verbose`
Expected: FAIL — módulo `./use-storage-drives` não existe.

- [ ] **Step 3: Implement `use-storage-drives.ts`**

Ler `state`/`refresh`/`hasFetched` de `useSystemContext()`; `drives = state.status === 'success' ? state.data.drives : []`. Normalizar letras com `letter.toUpperCase()` antes de guardar em `selected`/`optimizeFlags`/`busy`. `cleanup`/`optimize` limpam erro anterior da letra, adicionam ao `busy`, chamam `api.runDiskCleanup`/`api.optimizeDrive`, em sucesso marcam `applied[letter] = true` e chamam `refresh()`, em falha gravam `errors[letter] = errorMessage(e)`, e sempre removem a letra de `busy` no `finally`. `cleanupSelected` executa `cleanup` para cada `selected`, em seguida `optimize` para cada letra em `selected ∩ optimizeFlags` cujo `drive.type` comece com `'SSD'`. `useEffect` chama `refresh()` uma vez quando `!hasFetched`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/hooks/use-storage-drives.test.ts --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-storage-drives.ts src/hooks/use-storage-drives.test.ts
git commit -m "feat(storage): adiciona hook de selecao e acoes por disco"
```

---

### Task 4: Painel `StorageSettingsPanel`

**Files:**

- Create: `src/components/storage/StorageSettingsPanel.tsx`
- Test: `src/components/storage/StorageSettingsPanel.test.tsx`

**Interfaces:**

- Consumes: `useStorageDrives` da Task 3, `SettingsPreviewLayout`/`Button`/`AnimatedNumber` de `../ui`, `cn` de `../../lib/utils`.
- Produces: `export function StorageSettingsPanel(): JSX.Element` — sem props; o estado vem do hook.

- [ ] **Step 1: Write the failing test**

```ts
// mock de ../../hooks/use-storage-drives com store de hook; drives:
// C: { letter:'C:', label:'Sistema', size:'512 GB', free:'200 GB', usedPercent:61, type:'SSD NVMe' }
// D: { letter:'D:', label:'Dados', size:'1 TB', free:'244 GB', usedPercent:78, type:'HD' }
it('mostra um card por disco com tipo, capacidade total e espaco livre', () => {
  render(<StorageSettingsPanel />);
  expect(screen.getAllByText('Disco C:')).toHaveLength(1);
  expect(screen.getAllByText('Disco D:')).toHaveLength(1);
  expect(screen.getByText('SSD NVMe')).toBeDefined();
  expect(screen.getByText('HD')).toBeDefined();
  expect(screen.getByText('512 GB')).toBeDefined();
  expect(screen.getByText('200 GB livres')).toBeDefined();
  expect(screen.getByText('1 TB')).toBeDefined();
  expect(screen.getByText('244 GB livres')).toBeDefined();
});

it('esconde otimizacao e o botao Otimizar SSD no HD', () => {
  render(<StorageSettingsPanel />);
  expect(screen.getAllByRole('checkbox', { name: 'Incluir otimização SSD (TRIM)' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Otimizar SSD' })).toHaveLength(1);
});

it('chama as acoes do hook com a letra do card', () => {
  render(<StorageSettingsPanel />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Limpeza de disco' })[1]);
  expect(hook.cleanup).toHaveBeenCalledWith('D:');
  fireEvent.click(screen.getByRole('button', { name: 'Otimizar SSD' }));
  expect(hook.optimize).toHaveBeenCalledWith('C:');
});

it('so habilita a acao em lote com selecao e respeita o checkbox de TRIM', () => {
  render(<StorageSettingsPanel />);
  const bulk = screen.getByRole('button', { name: 'Executar limpeza nos selecionados' });
  expect((bulk as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Disco C:' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir otimização SSD (TRIM)' }));
  expect((bulk as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(bulk);
  expect(hook.cleanupSelected).toHaveBeenCalledTimes(1);
});

it('mostra esqueleto, erro com retry e estado vazio', () => {
  store.state = { status: 'loading' };
  const { rerender } = render(<StorageSettingsPanel />);
  expect(document.querySelector('.animate-pulse')).not.toBeNull();

  store.state = { status: 'error', error: 'WMI indisponível' };
  rerender(<StorageSettingsPanel />);
  expect(screen.getByText('WMI indisponível')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(hook.refresh).toHaveBeenCalled();

  store.state = { status: 'success', data: { drives: [] } };
  rerender(<StorageSettingsPanel />);
  expect(screen.getByText('Nenhuma unidade encontrada')).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/storage/StorageSettingsPanel.test.tsx --reporter=verbose`
Expected: FAIL — módulo `./StorageSettingsPanel` não existe.

- [ ] **Step 3: Implement `StorageSettingsPanel.tsx`**

Um `<section>` com cabeçalho **Ajustes do Windows** e pill **Por disco**; quando `state.status !== 'success'` (ou `drives.length === 0`) renderizar esqueleto/erro/estado vazio. Para cada `StorageDrive`, um `DiskCard` com: cabeçalho `Disco {letter}` (dot + `label` quando houver) e badge do tipo apenas se estiver em `['SSD NVMe','SSD','HD']`; `SettingsPreviewLayout` com `preview` = ícone decorativo via CSS, `<AnimatedNumber value={usedPercent} suffix="%" />`, `size` (total) e `${free} livres` exibidos como texto recebido, e barra de Progresso cuja cor vem da regra `<70` primary, `<90` warning, senão destructive; `children` = checkbox `Selecionar Disco {letter}` e, só para `type.startsWith('SSD')`, checkbox `Incluir otimização SSD (TRIM)`; `footer` = botões `Limpeza de disco` e `Otimizar SSD` (somente SSD) e texto de erro `applied`/`errors` da letra. Acima dos cards, barra com contador de selecionados e botão `Executar limpeza nos selecionados` desabilitado sem seleção. Usar `data-drive-letter={letter}` no card para as asserções.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/storage/StorageSettingsPanel.test.tsx --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storage/StorageSettingsPanel.tsx src/components/storage/StorageSettingsPanel.test.tsx
git commit -m "feat(storage): adiciona painel de discos no padrao B"
```

---

### Task 5: Integração na página, TweaksPage e README

**Files:**

- Modify: `src/components/TweaksPage.tsx:20-41,89-110,139` (prop `beforeContent`)
- Test: `src/components/TweaksPage.test.tsx`
- Modify: `src/pages/StoragePage.tsx:41-47`
- Test: `src/pages/StoragePage.test.tsx`
- Modify: `README.md`

**Interfaces:**

- Consumes: `StorageSettingsPanel` da Task 4.
- Produces: `TweaksPageProps.beforeContent?: ReactNode`, renderizado antes dos três caminhos de estado.

- [ ] **Step 1: Write the failing tests**

```ts
// TweaksPage.test.tsx — acrescentar:
it('renderiza beforeContent mesmo durante loading e erro', () => {
  store.page = { status: 'loading' };
  const { rerender, container } = render(<TweaksPage {...base} beforeContent={<p>Painel sempre visível</p>} />);
  expect(screen.getByText('Painel sempre visível')).toBeDefined();
  store.page = { status: 'error', error: 'x' };
  rerender(<TweaksPage {...base} beforeContent={<p>Painel sempre visível</p>} />);
  expect(screen.getByText('Painel sempre visível')).toBeDefined();
});

// StoragePage.test.tsx — mockar ../contexts/SystemContext com drives de exemplo e:
it('mostra o painel de discos antes da barra de tweaks', () => {
  const { container } = renderPage();
  expect(screen.getByText('Ajustes do Windows')).toBeDefined();
  expect(screen.getByText('Por disco')).toBeDefined();
  const panel = screen.getByText('Ajustes do Windows');
  const toolbar = screen.getByTestId('tweaks-list');
  expect(panel.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/TweaksPage.test.tsx src/pages/StoragePage.test.tsx --reporter=verbose`
Expected: FAIL — `beforeContent` não existe e o painel não aparece.

- [ ] **Step 3: Integrar**

Adicionar `beforeContent?: ReactNode` em `TweaksPageProps` e renderizar `{beforeContent}` no topo do retorno, antes dos `if` de `extraLoading/loading` e `error`, para que o painel continue visível nesses estados. Em `StoragePage`, importar `StorageSettingsPanel` e passar `beforeContent={<StorageSettingsPanel />}` a `TweaksPage`, mantendo `transform` intacto. No caminho de sucesso o painel fica logo abaixo do banner (ver Task 6). No `README.md`, documentar o painel por disco e conferir a linha da barra lateral já editada.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/components/TweaksPage.test.tsx src/pages/StoragePage.test.tsx --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Gate final e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: `Test Files` e `Tests` todos verdes.

```bash
git add src/components/TweaksPage.tsx src/components/TweaksPage.test.tsx src/pages/StoragePage.tsx src/pages/StoragePage.test.tsx README.md
git commit -m "feat(storage): integra painel de discos na pagina Armazenamento"
```

## Task 6: Hero no padrão das páginas de dispositivo

- [ ] **Step 1: Escrever testes que falhem**

Criar `src/components/hero/DeviceHero.test.tsx` cobrindo foto (`role="img"` com `imageAlt`), selo, título e descrição animada. Em `src/components/TweaksPage.test.tsx`, exigir que `heroContent` substitua o `HeroBanner` padrão e apareça **antes** de `beforeContent`. Em `src/pages/StoragePage.test.tsx`, trocar a asserção de `[data-hero-animation="storage"]` por: imagem com alt `Unidades de armazenamento HD e SSD`, ausência do visual antigo, descrição atual e hero posicionado antes de `Ajustes do Windows`. Também atualizar `DevicePage.test.tsx` se necessário — o banner de periférico deve continuar idêntico.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/hero/DeviceHero.test.tsx src/components/TweaksPage.test.tsx src/pages/StoragePage.test.tsx src/pages/DevicePage.test.tsx --reporter=verbose`
Expected: FAIL — `DeviceHero` não existe e a página ainda renderiza `AnimatedStorage`.

- [ ] **Step 3: Implementar**

Extrair o banner de `DevicePage.tsx` para `src/components/hero/DeviceHero.tsx` (props `badge`, `icon`, `title`, `description`, `image`, `imageAlt`), mantendo `GlareHover`, máscara na foto, gradiente e `BlurText`. `DevicePage` passa a usar `DeviceHero`. Em `TweaksPage`, adicionar `heroContent?: ReactNode`: no caminho de sucesso ele substitui o `HeroBanner` e é renderizado **antes** de `beforeContent`, dentro do mesmo `space-y-6`; loading e erro continuam com apenas `beforeContent`. Em `StoragePage`, importar `src/assets/storage-drives.jpg` e passar `heroContent={<DeviceHero ... imageAlt="Unidades de armazenamento HD e SSD" />}`; remover import de `AnimatedStorage`. Atualizar spec, plano, ledger e README, incluindo crédito da foto.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/components/hero/DeviceHero.test.tsx src/components/TweaksPage.test.tsx src/pages/StoragePage.test.tsx src/pages/DevicePage.test.tsx src/pages/DevicePages.test.tsx --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Gate final e commit**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: `Test Files` e `Tests` todos verdes.

```bash
git add src/assets/storage-drives.jpg src/components/hero/DeviceHero.tsx src/components/hero/DeviceHero.test.tsx src/components/TweaksPage.tsx src/components/TweaksPage.test.tsx src/pages/DevicePage.tsx src/pages/StoragePage.tsx src/pages/StoragePage.test.tsx README.md docs/superpowers .superpowers
git commit -m "feat(storage): troca hero animado por banner com foto de HD e SSD"
```
