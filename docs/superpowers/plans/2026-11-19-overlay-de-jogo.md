# Overlay de jogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página **Overlay de jogo** em Ferramentas, com cadastro de jogos por `.exe`, captura real de FPS via PresentMon e um pill transparente que aparece sozinho quando o jogo cadastrado abre em borderless.

**Architecture:** Serviços no main process cuidam de persistência, resolvedor de capas da Steam, monitoramento de processos, download/verificação do PresentMon e cálculo do FPS suavizado. Um `OverlayManager` orquestra o ciclo de vida e atualiza uma `BrowserWindow` separada, transparente e que ignora o mouse. O renderer da página consome tudo por IPC; o renderer do overlay é uma entrada mínima separada no electron-vite.

**Tech Stack:** Electron 45, React 19, TypeScript, zod, Vitest, Testing Library, PowerShell (`Get-CimInstance`, P/Invoke via `Add-Type`), Steam Store API, PresentMon 2.3.1.

**Spec:** `docs/superpowers/specs/2026-11-19-overlay-de-jogo-design.md`

## Global Constraints

- Windows apenas. Renderer tem `connect-src 'self'`: todo HTTP e todo spawn ficam no main process.
- Dados em `%APPDATA%\fm-optimize\` (packaged) / `data/` (dev), seguindo `getDataDir()`.
- Interface e textos em português; usar reticência `…`, não `...`.
- Todo código novo precisa de teste de comportamento real; bug fix precisa de teste vermelho-verde.
- Gate antes de qualquer commit: `bun run lint && bun run typecheck && bun run test`.
- **Não commitar, dar push nem criar release sem pedido explícito.** Os passos de commit do template são substituídos por "rodar o gate".
- Não modificar `.gitignore` para `.superpowers/` — já está ignorado.

## Review Focus

- Jogo cadastrado que roda em **tela cheia exclusiva**: o app não promete overlay; deve explicar no texto da página que só borderless é suportado. → teste: página exibe o aviso.
- Falta de privilégio do PresentMon: status deve virar `error` com mensagem acionável, nunca silêncio. → teste: serviço de download/captura devolve erro explícito e página renderiza o aviso com botão.
- `.exe` fora da Steam: capa deve cair para card de iniciais sem quebrar o cadastro. → teste: resolvedor devolve `null` e `addOverlayGame` persiste o jogo com `coverFile: null`.
- Múltiplos jogos cadastrados rodando ao mesmo tempo: apenas o jogo em foco (ou o primeiro habilitado quando `onlyWhenFocused` estiver desligado) deve ser capturado. → teste: `selectActiveGame` com lista e PID em foco.
- Queda de FPS abaixo do alvo e recuperação: cor do número e média suavizada devem reagir, sem piscar a cada frame. → teste: `computeSmoothedFps` e `frameColor` com amostras.
- Atalho global conflitante: registrar pode falhar; a página deve mostrar o erro em vez de fingir que funcionou. → teste: manager propaga falha de `globalShortcut.register`.

---

### Task 1: Tipos compartilhados e validação dos canais

**Files:**

- Create: `electron/shared/overlay-types.ts`
- Modify: `electron/shared/ipc-types.ts` (adicionar métodos ao `ElectronAPI`)
- Modify: `electron/main/validation.ts` (schemas + `IpcSchemas`)
- Modify: `electron/main/services/rate-limit.ts` (limites por canal)
- Test: `electron/main/tests/overlay-validation.test.ts`

**Interfaces:**

- Produces: `OverlayGame`, `OverlaySettings`, `OverlayPosition`, `OverlayStatus`, `OverlayFrame`, `AddOverlayGameInput`, `SetOverlayGameEnabledInput` em `electron/shared/overlay-types.ts`.

- [ ] **Step 1: Escrever teste que exige schemas para os onze canais novos**

```ts
import { validateIpcInput } from '../validation';
it.each([
  ['get-overlay-games', undefined],
  ['add-overlay-game', { exePath: 'C:\\Jogos\\cs2.exe' }],
  ['remove-overlay-game', 'id'],
  ['set-overlay-game-enabled', { id: 'id', enabled: true }],
  ['get-overlay-settings', undefined],
  [
    'save-overlay-settings',
    {
      hotkey: 'Ctrl+Shift+F',
      position: 'top-left',
      opacity: 0.85,
      targetFps: 60,
      onlyWhenFocused: true,
    },
  ],
  ['get-overlay-status', undefined],
  ['start-overlay-monitor', undefined],
  ['stop-overlay-monitor', undefined],
  ['restart-overlay-elevated', undefined],
  ['choose-overlay-exe', undefined],
])('valida %s', (channel, input) => {
  expect(validateIpcInput(channel, input).success).toBe(true);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `bun run test -- electron/main/tests/overlay-validation.test.ts`
Expected: FAIL (canais ausentes em `IpcSchemas`).

- [ ] **Step 3: Definir os tipos e os schemas zod**

`OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`; `OverlaySettings.opacity` entre `0.2` e `1`; `targetFps` inteiro de `30` a `360`; `hotkey` string de `3` a `60`; `exePath` caminho absoluto Windows. `OverlayStatus.capture` é `'idle' | 'waiting' | 'capturing' | 'error'`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun run test -- electron/main/tests/overlay-validation.test.ts`

- [ ] **Step 5: Rodar o gate**

Run: `bun run format && bun run lint && bun run typecheck`

---

### Task 2: Persistência da lista de jogos e das configurações

**Files:**

- Create: `electron/main/services/overlay-storage.ts`
- Test: `electron/main/tests/overlay-storage.test.ts`

**Interfaces:**

- Consumes: `OverlayGame`, `OverlaySettings` (Task 1).
- Produces: `gameId(exePath: string): string`, `getOverlayGames(): OverlayGame[]`, `addOverlayGame(input: AddOverlayGameInput): OverlayGame`, `removeOverlayGame(id: string): void`, `setOverlayGameEnabled(id: string, enabled: boolean): void`, `getOverlaySettings(): OverlaySettings`, `saveOverlaySettings(settings: OverlaySettings): void`, `DEFAULT_OVERLAY_SETTINGS`.

- [ ] **Step 1: Teste de id estável e inferência de nome**

```ts
it('gera id estável e nome a partir da pasta do executável', () => {
  expect(gameId('C:\\Jogos\\CS2\\cs2.exe')).toBe(gameId('c:\\jogos\\cs2\\CS2.exe'));
  expect(inferGameName('C:\\Jogos\\Cyberpunk 2077\\bin\\Cyberpunk2077.exe')).toBe('Cyberpunk 2077');
});
```

- [ ] **Step 2: Rodar e verificar que falha** — `bun run test -- electron/main/tests/overlay-storage.test.ts`.

- [ ] **Step 3: Implementar leitura/escrita atômica**

Usar `getDataDir()` de `data-service.ts`, arquivos `overlay-games.json` e `overlay-settings.json`, `<file>.tmp` + `renameSync`, e defaults tolerantes como `loadSettings()`. `addOverlayGame` é idempotente por `gameId` e preenche `processName` com `basename(exePath)`.

- [ ] **Step 4: Teste de persistência e idempotência**

```ts
it('adiciona uma vez e alterna o habilitado', () => {
  const game = addOverlayGame({ exePath: 'C:\\Jogos\\CS2\\cs2.exe' });
  expect(addOverlayGame({ exePath: 'C:\\Jogos\\CS2\\cs2.exe' }).id).toBe(game.id);
  expect(getOverlayGames()).toHaveLength(1);
  setOverlayGameEnabled(game.id, false);
  expect(getOverlayGames()[0].enabled).toBe(false);
});
```

- [ ] **Step 5: Rodar testes e gate** — `bun run test -- electron/main/tests/overlay-storage.test.ts && bun run format && bun run lint && bun run typecheck`.

---

### Task 3: Capa automática via Steam

**Files:**

- Create: `electron/main/services/steam-cover.ts`
- Test: `electron/main/tests/steam-cover.test.ts`

**Interfaces:**

- Consumes: `OverlayGame` (Task 1).
- Produces: `resolveSteamAppId(exePath: string, deps?: { readFileSync?, existsSync?, fetchFn? }): Promise<number | null>`, `downloadSteamCover(appId: number, deps?: { fetchFn?, writeFileSync? }): Promise<string | null>` (retorna o nome do arquivo no diretório `covers/`).

- [ ] **Step 1: Teste de resolução por appmanifest**

```ts
it('resolve appid pelo installdir do appmanifest', async () => {
  const acf =
    '"AppState"\n{\n "appid"\t\t"730"\n "installdir"\t\t"Counter-Strike Global Offensive"\n}';
  await expect(
    resolveSteamAppId('C:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\cs2.exe', {
      readdirSync: () => ['appmanifest_730.acf'],
      readFileSync: () => acf,
    })
  ).resolves.toBe(730);
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar ACF + fallback `storesearch`**

Procurar `steamapps/common` no caminho; ler `appmanifest_*.acf` e comparar `installdir` (case-insensitive). Sem match, usar `https://store.steampowered.com/api/storesearch/?term=…&l=portuguese&cc=BR` com nome da pasta, exigir `type === 'app'`, e escolher o primeiro com nome normalizado contido no termo.

- [ ] **Step 4: Teste de download e cache**

```ts
it('salva a capa vertical em covers/ e devolve o nome do arquivo', async () => {
  const writeFileSync = vi.fn();
  const fetchFn = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as never;
  await expect(downloadSteamCover(730, { fetchFn, writeFileSync })).resolves.toBe('730.jpg');
  expect(fetchFn).toHaveBeenCalledWith(
    expect.stringContaining('/730/library_600x900.jpg'),
    expect.anything()
  );
  expect(writeFileSync).toHaveBeenCalledWith(
    expect.stringContaining('730.jpg'),
    expect.any(Buffer)
  );
});
```

- [ ] **Step 5: Teste de ausência de match** — `resolveSteamAppId` devolve `null` para exe fora da Steam e `storesearch` vazio; `addOverlayGame` (Task 2) mantém `coverFile: null`.

- [ ] **Step 6: Rodar testes e gate.**

---

### Task 4: Monitoramento de processos e jogo em foco

**Files:**

- Create: `electron/main/services/overlay-processes.ts`
- Test: `electron/main/tests/overlay-processes.test.ts`

**Interfaces:**

- Consumes: `OverlayGame` (Task 1).
- Produces: `selectActiveGame(games: OverlayGame[], running: Array<{ processName: string; pid: number }>, foregroundPid: number | null, onlyWhenFocused: boolean): OverlayGame | null`, `listRunningProcesses(deps?: { execPowerShellSafe? }): Promise<Array<{ processName: string; pid: number }>>`, `getForegroundPid(deps?: { execPowerShellSafe? }): Promise<number | null>`.

- [ ] **Step 1: Teste puro de seleção**

```ts
it('prefere o jogo em foco e respeita jogos desabilitados', () => {
  const cs2 = { ...game, processName: 'cs2.exe', enabled: true };
  const disabled = { ...game, id: 'b', processName: 'jogo.exe', enabled: false };
  expect(
    selectActiveGame(
      [disabled, cs2],
      [
        { processName: 'cs2.exe', pid: 10 },
        { processName: 'jogo.exe', pid: 20 },
      ],
      20,
      true
    )?.id
  ).toBe('cs2');
  expect(
    selectActiveGame(
      [disabled, cs2],
      [
        { processName: 'cs2.exe', pid: 10 },
        { processName: 'jogo.exe', pid: 20 },
      ],
      20,
      false
    )?.id
  ).toBe('cs2');
  expect(selectActiveGame([disabled, cs2], [], 20, false)).toBeNull();
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar listagem e foco via PowerShell**

`Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.Name)" }`; parsear linhas `pid<TAB>nome`, lower-case no nome. Para foco, `Add-Type`com`GetForegroundWindow`/`GetWindowThreadProcessId`do`user32.dll`. Injeter `execPowerShellSafe` para teste.

- [ ] **Step 4: Teste de parse** — devolver lista correta de uma saída simulada e `null` para saída vazia/ inválida.

- [ ] **Step 5: Rodar testes e gate.**

---

### Task 5: PresentMon — download, verificação, captura e suavização

**Files:**

- Create: `electron/main/services/presentmon.ts`
- Test: `electron/main/tests/presentmon.test.ts`

**Interfaces:**

- Consumes: nada além de Node/Electron.
- Produces: `PRESENTMON_VERSION = '2.3.1'`, `PRESENTMON_SHA256` (constante com o hash real do asset baixado na implementação), `ensurePresentMon(deps?: { fetchFn?, existsSync?, mkdirSync?, writeFileSync?, createHash? }): Promise<{ path: string } | { error: string }>`, `parseCsvSample(line: string, header: string[]): number | null` (ms entre presents), `computeSmoothedFps(samplesMs: number[]): number | null`, `frameColor(fps: number, targetFps: number): 'good' | 'bad'`, `buildPresentMonArgs(processName: string): string[]`, `startCapture(processName: string, onMs: (ms: number) => void, deps?: { spawn? }): () => void`.

- [ ] **Step 1: Teste de argumentos e parsing**

```ts
it('monta argumentos e calcula fps suavizado', () => {
  expect(buildPresentMonArgs('cs2.exe')).toEqual(
    expect.arrayContaining([
      '--process_name',
      'cs2.exe',
      '--output_stdout',
      '--terminate_on_proc_exit',
    ])
  );
  expect(computeSmoothedFps(Array(60).fill(10))).toBe(100);
  expect(frameColor(59, 60)).toBe('bad');
  expect(frameColor(60, 60)).toBe('good');
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar download verificado e spawn**

Baixar `https://github.com/GameTechDev/PresentMon/releases/download/v2.3.1/PresentMon-2.3.1-x64.exe` para `%APPDATA%\fm-optimize\tools\`, calcular SHA256 e rejeitar hash diferente. `startCapture(processName, onMs, deps?)` usa `spawn` com `buildPresentMonArgs`, acumula linhas do stdout, chama `parseCsvSample` e devolve uma função de parada que mata o processo. Nunca inventar valores.

- [ ] **Step 4: Teste de rejeição de hash errado e erro de rede**

```ts
it('rejeita binário com hash divergente', async () => {
  await expect(
    ensurePresentMon({
      fetchFn: fakeFetch,
      createHash: () => ({
        update() {
          return this;
        },
        digest: () => 'errado',
      }),
    } as never)
  ).resolves.toMatchObject({ error: expect.stringMatching(/hash|integridade/i) });
});
```

- [ ] **Step 5: Rodar testes e gate.**

---

### Task 6: Janela do overlay e atalho global

**Files:**

- Create: `overlay.html`
- Create: `src/overlay/main.tsx`
- Create: `electron/preload/overlay.ts`
- Create: `electron/main/overlay-window.ts`
- Modify: `electron.vite.config.ts:18-24,53-55` (novas entradas `overlay`)
- Test: `src/overlay/main.test.tsx`, `tests/overlay-bridge.test.ts`

**Interfaces:**

- Consumes: `OverlayFrame`, `OverlaySettings` (Task 1).
- Produces: `createOverlayWindow(): BrowserWindow`, `showOverlayWindow(): void`, `hideOverlayWindow(): void`, `updateOverlayFrame(frame: OverlayFrame): void`, `applyOverlaySettings(settings: OverlaySettings): void`, `destroyOverlayWindow(): void`, e no preload `onOverlayFrame(cb): () => void`, `onOverlaySettings(cb): () => void`.

- [ ] **Step 1: Teste do renderer do overlay**

```tsx
it('mostra o número em verde acima do alvo e em vermelho abaixo', () => {
  render(<OverlayPill />);
  act(() => emitFrame({ fps: 120, color: 'good', visible: true }));
  expect(screen.getByText('120')).toBeTruthy();
  expect(screen.getByTestId('fps-value').className).toContain('good');
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar janela e prévia**

Janela com `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `setIgnoreMouseEvents(true)`, `focusable: false`. Posição calculada a partir de `screen.getPrimaryDisplay().workAreaSize` e `OverlayPosition`, com margem 24 px. Atualizar texto/cor/opacidade via eventos do preload. Registrar `globalShortcut.register(settings.hotkey, toggleOverlayWindow)`.

- [ ] **Step 4: Teste do bridge do overlay** — importar o preload real com `vi.mock('electron')`, assertir `onOverlayFrame`/`onOverlaySettings` e unsubscribe.

- [ ] **Step 5: Rodar testes e gate.**

---

### Task 7: Orquestração e IPC

**Files:**

- Create: `electron/main/services/overlay-manager.ts`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/shared/ipc-types.ts`
- Modify: `electron/main/services/rate-limit.ts`
- Test: `electron/main/tests/overlay-manager.test.ts`, `tests/overlay-bridge.test.ts`

**Interfaces:**

- Consumes: Tasks 2–6.
- Produces: `createOverlayManager(deps: OverlayManagerDeps): OverlayManager`, onde `OverlayManager` expõe `tick(): Promise<void>`, `getStatus(): OverlayStatus`, `setRunningProcesses(processes: Array<{ processName: string; pid: number }>): void`, `start(): void`, `stop(): void`; e `startOverlayMonitor()/stopOverlayMonitor()/getOverlayStatus()/restartOverlayElevated()` como wrappers de instância única. No `ElectronAPI`: os onze métodos de comando mais `onOverlayStatus(cb): () => void`.

- [ ] **Step 1: Teste de ciclo de vida com dependências injetadas**

```ts
it('inicia captura quando o jogo abre e para quando fecha', async () => {
  const manager = createOverlayManager({ listRunningProcesses: async () => [{ processName: 'cs2.exe', pid: 10 }], getForegroundPid: async () => 10, startCapture: vi.fn(() => vi.fn()), ... });
  await manager.tick();
  expect(manager.getStatus()).toMatchObject({ capture: 'capturing', activeGameId: 'cs2' });
  manager.setRunningProcesses([]);
  await manager.tick();
  expect(manager.getStatus().capture).toBe('idle');
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar manager**

Loop a cada 1 s com `setInterval`; compara `selectActiveGame`, inicia/para PresentMon, publica `overlay:status` e `overlay:frame`; aplica config na janela. `selectActiveGame` considera só jogos habilitados e rodando: com `onlyWhenFocused`, prefere o jogo cujo PID é o da janela em foco e, se ele não for elegível, usa o primeiro habilitado rodando; sem a opção, usa o primeiro habilitado rodando. `restartOverlayElevated` usa `relaunchElevated(['--overlay-elevated'])`, marca `appState.isQuitting` e encerra como `elevate-app`. O monitor inicia no boot do app (inclusive `--hidden`/bandeja) e, enquanto houver jogos habilitados, o fechamento da janela principal deve manter o app residente na bandeja; no boot com `--overlay-elevated`, iniciar monitor automaticamente.

- [ ] **Step 4: Teste de falha de permissão** — `ensurePresentMon` com erro → status `error`, mensagem em português, sem exceção solta.

- [ ] **Step 5: Teste do bridge principal** — cada novo método chama o canal correspondente e rejeita em `{ success: false }`.

- [ ] **Step 6: Rodar testes e gate.**

---

### Task 8: Página Overlay de jogo

**Files:**

- Create: `src/pages/OverlayJogoPage.tsx`
- Create: `src/pages/OverlayJogoPage.test.tsx`
- Modify: `src/routes/config.ts`, `src/routes/config.test.ts`, `src/layout/Sidebar.test.tsx`

**Interfaces:**

- Consumes: `ElectronAPI` (Task 7).
- Produces: rota `/overlay-jogo`, categoria `ferramentas`, rótulo `Overlay de jogo`.

- [ ] **Step 1: Teste da página com lista, engrenagem e aviso de borderless**

```tsx
it('abre com a lista de jogos, a engrenagem e o aviso de borderless', async () => {
  installApi({ games: [cs2], settings: DEFAULT_OVERLAY_SETTINGS, status: idleStatus });
  render(<OverlayJogoPage />);
  expect(await screen.findByRole('heading', { name: 'Overlay de jogo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /configurações do overlay/i })).toBeTruthy();
  expect(screen.getByText(/tela cheia exclusiva não é suportada/i)).toBeTruthy();
  expect(screen.getByText('Counter-Strike 2')).toBeTruthy();
});
```

- [ ] **Step 2: Rodar e verificar que falha.**

- [ ] **Step 3: Implementar página**

Seguir `CompararPlacaPage`: `HeroBanner` + `AnimatedHero`, cards com capa (quando houver) ou iniciais, switch por jogo, botão "Adicionar jogo" (abre `showOpenDialog` via IPC — canal `choose-overlay-exe`), painel da engrenagem com atalho gravável, posição, opacidade, alvo de FPS e foco. Aviso de permissão com botão "Reiniciar como administrador" quando `status.error` mencionar privilégio. Prévia do pill.

- [ ] **Step 4: Testes de interação** — adicionar jogo, alternar habilitado, salvar configuração, erro de permissão, conflito de atalho, caso sem capa.

- [ ] **Step 5: Atualizar expectativas de rota/sidebar e rodar gate completo.**

---

### Task 9: Documentação e verificação final

**Files:**

- Modify: `README.md`
- Test: nenhum novo.

- [ ] **Step 1: Atualizar README** com a nova ferramenta, requisitos (borderless, privilégio, PresentMon baixado na primeira vez) e fonte das capas.

- [ ] **Step 2: Rodar gate completo**

Run: `bun run format && bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 3: Revisar diff final** — `git status --short`, conferir que `.env.local` e `.superpowers/` não aparecem, e **não commitar**.
