# Internet Speed Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao FM-Optimize uma página `/velocidade` que mede a velocidade real da conexão (download, upload, ping e jitter) e mostra uma animação de medidor com agulha semelhante à de sites de speed test.

**Architecture:** A medição roda no processo principal do Electron com `fetch` contra os endpoints públicos da Cloudflare (`/__down` e `/__up`), porque o CSP do renderer (`connect-src 'self'`) bloquearia chamadas diretas. O progresso volta por eventos IPC nomeados; o renderer mantém estado num provider local à página e desenha o medidor em SVG com CSS transitions.

**Tech Stack:** Electron 45 (main + preload via electron-vite), React 19, TypeScript, Tailwind CSS 4, lucide-react, Vitest + Testing Library, Biome, bun.

**Spec:** `docs/superpowers/specs/2026-11-18-internet-speed-test-design.md`

## Global Constraints

- Gate antes de **cada** commit: `bun run lint && bun run typecheck && bun run test`.
- Build antes de concluir: `bun run build`.
- TDD: nenhum código de produção sem teste que falhe antes.
- Biome é o linter/formatter; jamais editar manualmente formatação que `bun run format` resolve.
- A API global do renderer é `window.electronAPI` (não `window.api`) e rejeita **strings**, não `Error`.
- Canais IPC precisam de três pontos de fiação: handler em `ipc-handlers.ts`, schema em `validation.ts`, config em `services/rate-limit.ts` e método no preload + `ElectronAPI`.
- Página nova é `protected: true` na categoria `rede`; menu, rota e Page Lock derivam de `ROUTES`.
- Não salvar resultado em disco, `localStorage` ou configurações.
- Não commitar `.env.local`; trabalhar sempre na raiz do repositório.

## Review Focus

- **Sem conexão / fetch rejeita:** o usuário deve ver erro e poder tentar de novo, sem medidor preso no meio — teste de rejeição em `speed-test.test.ts`, teste de estado `error` em `SpeedContext.test.tsx` e teste do botão “Tentar novamente” em `SpeedTestPage.test.tsx`.
- **Cancelamento no meio da medição:** nenhuma requisição deve continuar e a página volta ao estado inicial — teste de abort em `speed-test.test.ts` e teste de `cancel()` em `SpeedContext.test.tsx`.
- **Tempo zero ou negativo:** nunca produzir `Infinity`/`NaN` em Mbps, ping ou jitter — teste com `now()` constante em `speed-test.test.ts`.
- **Requisição travada:** timeout por requisição para o teste não ficar para sempre em “medindo” — teste com fetch que nunca resolve em `speed-test.test.ts`.
- **Movimento reduzido:** a agulha não deve animar quando `prefers-reduced-motion: reduce` — teste de classe em `SpeedGauge.test.tsx`.

---

### Task 1: Serviço de medição no main

**Files:**

- Modify: `electron/shared/ipc-types.ts` (tipos compartilhados)
- Create: `electron/main/services/speed-test.ts`
- Test: `electron/main/tests/speed-test.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `export type SpeedTestPhase = 'latency' | 'download' | 'upload' | 'done';`
  - `export interface SpeedProgress { phase: SpeedTestPhase; progress: number; currentMbps: number | null; }`
  - `export interface SpeedTestResult { downloadMbps: number; uploadMbps: number; pingMs: number; jitterMs: number; }`
  - `export function runSpeedTest(onProgress: (progress: SpeedProgress) => void, options?: SpeedTestOptions): Promise<SpeedTestResult>;`
  - `export function cancelSpeedTest(): void;`
  - `SpeedTestOptions`: `{ fetchFn?: typeof fetch; now?: () => number; latencyCount?: number; downloadSizes?: number[]; uploadSizes?: number[]; }`

- [ ] **Step 1: Write the failing tests**

Crie `electron/main/tests/speed-test.test.ts` com fetch e relógio injetados. Cubra, no mínimo:

```ts
it('mede download, upload, ping e jitter e publica progresso em ordem', async () => {
  const progress: SpeedProgress[] = [];
  const result = await runSpeedTest((p) => progress.push(p), {
    fetchFn: fakeFetch,
    now: fakeClock(100),
    latencyCount: 3,
    downloadSizes: [1000],
    uploadSizes: [1000],
  });
  expect(result).toEqual({ downloadMbps: 0.08, uploadMbps: 0.08, pingMs: 100, jitterMs: 0 });
  expect(progress.map((p) => p.phase)).toEqual(['latency', 'download', 'upload', 'done']);
  expect(progress.at(-1)?.progress).toBe(1);
});
```

```ts
it('rejeita com a mensagem do fetch quando a rede falha', async () => {
  await expect(
    runSpeedTest(() => {}, { fetchFn: vi.fn().mockRejectedValue(new Error('offline')) })
  ).rejects.toThrow('offline');
});

it('rejeita com Teste cancelado quando cancelSpeedTest é chamado durante a medição', async () => {
  const promise = runSpeedTest(() => {}, {
    fetchFn: slowFetch,
    latencyCount: 2,
    downloadSizes: [1000],
    uploadSizes: [1000],
  });
  cancelSpeedTest();
  await expect(promise).rejects.toThrow('Teste cancelado');
});

it('não gera NaN nem Infinity quando o relógio não avança', async () => {
  const result = await runSpeedTest(() => {}, {
    fetchFn: fakeFetch,
    now: () => 1000,
    latencyCount: 2,
    downloadSizes: [1000],
    uploadSizes: [1000],
  });
  expect(Object.values(result).every(Number.isFinite)).toBe(true);
});

it('aplica timeout por requisição', async () => {
  const pending = new Promise<Response>(() => {});
  await expect(
    runSpeedTest(() => {}, { fetchFn: vi.fn(() => pending), latencyCount: 1 })
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run electron/main/tests/speed-test.test.ts`
Expected: FAIL com “Cannot find module '../services/speed-test'”.

- [ ] **Step 3: Implement the service**

Em `electron/main/services/speed-test.ts`:

- Constantes privadas `DOWN_URL = 'https://speed.cloudflare.com/__down'`, `UP_URL = 'https://speed.cloudflare.com/__up'`; nunca aceitar URL do chamador.
- `runSpeedTest` cria um `AbortController` module-level, registrando-o como ativo; `cancelSpeedTest()` chama `abort()` nele.
- Cada requisição usa `{ cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), ... }` e `now()` antes/depois.
- Latência: N GETs em `/__down?bytes=0&r=<aleatório>`; coletar elapsed ms; `pingMs` = mediana, `jitterMs` = média das diferenças absolutas consecutivas (0 com uma amostra).
- Download: para cada tamanho em `downloadSizes`, fazer uma requisição; ler `response.body.getReader()` até `done`, somando `value.byteLength`; Mbps = `bytes * 8 / (segundos * 1_000_000)`.
- Upload: para cada tamanho em `uploadSizes`, `fetch(UP_URL, { method: 'POST', body: Buffer.alloc(bytes, 7) })`; aguardar a resposta; Mbps pela mesma fórmula com `bytes` conhecidos.
- `downloadMbps`/`uploadMbps` = p90 das amostras (com uma amostra, o próprio valor).
- Progresso: latência 10%, download 45%, upload 45%; emitir no início de cada fase e depois de cada amostra; `currentMbps` é a última amostra da fase, `null` na latência; ao final emitir `{ phase: 'done', progress: 1, currentMbps: null }`.
- Se `controller.signal.aborted`, rejeitar com `Error('Teste cancelado')`; se `elapsed <= 0`, usar `Number.EPSILON` no denominador para evitar `Infinity` (a medição real usa `performance.now()`; o `now()` injetado é só para teste).
- Valores padrão: `latencyCount = 10`, `downloadSizes = [100_000, 1_000_000, 10_000_000]`, `uploadSizes = [100_000, 1_000_000, 10_000_000]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run electron/main/tests/speed-test.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add electron/shared/ipc-types.ts electron/main/services/speed-test.ts electron/main/tests/speed-test.test.ts
git commit -m "feat: medição de velocidade no processo principal"
```

---

### Task 2: Fiação IPC e preload

**Files:**

- Modify: `electron/main/ipc-handlers.ts:141+` (registro dos handlers)
- Modify: `electron/main/validation.ts:192-251` e `electron/main/services/rate-limit.ts:18-39`
- Modify: `electron/preload/index.ts`, `electron/shared/ipc-types.ts`
- Test: `tests/speed-test-bridge.test.ts` (novo)

**Interfaces:**

- Consumes: `runSpeedTest` e `cancelSpeedTest` da Task 1; tipos `SpeedProgress` e `SpeedTestResult`.
- Produces em `ElectronAPI`:
  - `measureSpeed(): Promise<SpeedTestResult>`
  - `cancelSpeedTest(): Promise<void>`
  - `onSpeedProgress(callback: (progress: SpeedProgress) => void): () => void`

- [ ] **Step 1: Write the failing test**

Crie `tests/speed-test-bridge.test.ts`. Com `vi.mock('electron', ...)` expondo `contextBridge.exposeInMainWorld` e `ipcRenderer.invoke/on/removeListener` como `vi.fn()`, importe `electron/preload/index.ts` e afirme:

```ts
it('expõe measureSpeed, cancelSpeedTest e onSpeedProgress no electronAPI', () => {
  const api = exposed.electronAPI;
  expect(typeof api.measureSpeed).toBe('function');
  expect(typeof api.cancelSpeedTest).toBe('function');
  expect(typeof api.onSpeedProgress).toBe('function');
});

it('repassa o progresso do canal speed-progress para o callback', () => {
  const cb = vi.fn();
  const unsubscribe = exposed.electronAPI.onSpeedProgress(cb);
  listeners.get('speed-progress')!({}, { phase: 'download', progress: 0.5, currentMbps: 42 });
  expect(cb).toHaveBeenCalledWith({ phase: 'download', progress: 0.5, currentMbps: 42 });
  unsubscribe();
  expect(removeListener).toHaveBeenCalledWith('speed-progress', expect.any(Function));
});

it('chama os canais corretos no invoke', async () => {
  await exposed.electronAPI.measureSpeed();
  await exposed.electronAPI.cancelSpeedTest();
  expect(invoke).toHaveBeenCalledWith('measure-speed');
  expect(invoke).toHaveBeenCalledWith('cancel-speed-test');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/speed-test-bridge.test.ts`
Expected: FAIL porque os métodos ainda não existem.

- [ ] **Step 3: Implement handlers, validação, rate limit e preload**

- `ipc-handlers.ts`: registrar `ipcMain.handle('measure-speed', ...)` usando `handleIpcNoInput('measure-speed', () => runSpeedTest(p => event.sender.send('speed-progress', p)))` e `ipcMain.handle('cancel-speed-test', ...)` usando `handleIpcNoInput('cancel-speed-test', cancelSpeedTest)`.
- `validation.ts`: adicionar `'measure-speed': z.undefined()` e `'cancel-speed-test': z.undefined()` em `IpcSchemas`.
- `rate-limit.ts`: `'measure-speed': { windowMs: 60_000, maxRequests: 3 }` e `'cancel-speed-test': { windowMs: 1_000, maxRequests: 10 }`.
- `ipc-types.ts`: adicionar os três métodos à interface `ElectronAPI`.
- `preload/index.ts`: implementar `measureSpeed: () => ipc('measure-speed')`, `cancelSpeedTest: () => ipcVoid('cancel-speed-test')` e `onSpeedProgress` com o padrão `Set` + unsubscribe do arquivo (ver `onBenchmarkProgress`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/speed-test-bridge.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add electron/main/ipc-handlers.ts electron/main/validation.ts electron/main/services/rate-limit.ts electron/preload/index.ts electron/shared/ipc-types.ts tests/speed-test-bridge.test.ts
git commit -m "feat: expõe medição de velocidade via IPC"
```

---

### Task 3: Contexto do renderer

**Files:**

- Create: `src/contexts/SpeedContext.tsx`
- Test: `src/contexts/SpeedContext.test.tsx`

**Interfaces:**

- Consumes: `window.electronAPI.measureSpeed()`, `cancelSpeedTest()`, `onSpeedProgress()`.
- Produces:
  - `export function SpeedProvider({ children }: { children: ReactNode }): JSX.Element`
  - `export function useSpeedContext(): SpeedContextValue`
  - `SpeedContextValue = { status: 'idle' | 'measuring' | 'done' | 'error'; progress: SpeedProgress; result: SpeedTestResult | null; error: string | null; start: () => Promise<void>; cancel: () => Promise<void>; }`

- [ ] **Step 1: Write the failing tests**

Em `src/contexts/SpeedContext.test.tsx` (`// @vitest-environment jsdom`), monte `window.electronAPI` falso com `vi.hoisted` e um componente de teste que mostra `status`, `progress`, `result` e botões que chamam `start`/`cancel`. Afirme:

- ao clicar em iniciar: `measureSpeed` é chamado, `onSpeedProgress` é registrado e o progresso recebido aparece na tela;
- ao resolver: status vira `done` e os mbps aparecem;
- ao rejeitar com string `'offline'`: status vira `error` e o texto aparece;
- ao clicar em cancelar: `cancelSpeedTest` é chamado e o status volta a `idle`;
- o unsubscribe do listener é chamado ao finalizar.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/contexts/SpeedContext.test.tsx`
Expected: FAIL com “Cannot find module '../contexts/SpeedContext'”.

- [ ] **Step 3: Implement the context**

Espelhe `src/contexts/DnsContext.tsx`: provider local à página, `useState` para `status`, `progress`, `result`, `error`, `start` registrando `onSpeedProgress` antes de `measureSpeed` e fazendo unsubscribe no `finally`, `cancel` chamando a API e resetando estado. Normalize erro com `typeof e === 'string' ? e : (e as Error).message`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/contexts/SpeedContext.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/contexts/SpeedContext.tsx src/contexts/SpeedContext.test.tsx
git commit -m "feat: contexto de estado do teste de velocidade"
```

---

### Task 4: Medidor animado

**Files:**

- Create: `src/components/SpeedGauge.tsx`
- Test: `src/components/SpeedGauge.test.tsx`

**Interfaces:**

- Consumes: `SpeedTestPhase` da Task 1 e tokens CSS do tema.
- Produces:
  - `export interface SpeedGaugeProps { valueMbps: number; maxMbps?: number; progress: number; label: string; phase: SpeedTestPhase; active: boolean; }`
  - `export function SpeedGauge(props: SpeedGaugeProps): JSX.Element`

- [ ] **Step 1: Write the failing tests**

Em `src/components/SpeedGauge.test.tsx` (`// @vitest-environment jsdom`), renderize com `valueMbps: 42`, `maxMbps: 100`, `label: 'Download'`, `phase: 'download'`, `active: true`. Afirme:

- `screen.getByRole('img', { name: 'Download: 42.0 Mbps' })` existe;
- o elemento da agulha tem `style.transform` contendo a rotação esperada para 42% do arco;
- o traçado de progresso tem `strokeDashoffset` menor que 100;
- com `active: false`, a classe de transição `motion-reduce:transition-none` continua presente (movimento reduzido respeitado pelo CSS global).

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/SpeedGauge.test.tsx`
Expected: FAIL com “Cannot find module '../components/SpeedGauge'”.

- [ ] **Step 3: Implement the gauge**

SVG `viewBox="0 0 200 200"` com arco de `pathLength={100}` (track + fill via `strokeDasharray="100 100"` e `strokeDashoffset={100 - ratio * 100}`), agulha em `<g style={{ transform: rotate(...) }}>`, classes `transition-transform duration-700 ease-out motion-reduce:transition-none`, `role="img"` e `aria-label` com valor formatado. Usar `text-primary`/`text-muted-foreground`/tokens; `maxMbps` padrão 300. Texto central com o número e “Mbps”.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/SpeedGauge.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/SpeedGauge.tsx src/components/SpeedGauge.test.tsx
git commit -m "feat: medidor animado de velocidade"
```

---

### Task 5: Página, rota e documentação

**Files:**

- Create: `src/pages/SpeedTestPage.tsx`
- Modify: `src/pages/SpeedTestPage.test.tsx` (novo)
- Modify: `src/routes/config.ts`, `src/routes/config.test.ts`, `README.md`

**Interfaces:**

- Consumes: `SpeedProvider`/`useSpeedContext` da Task 3 e `SpeedGauge` da Task 4.
- Produces: rota `/velocidade` com `label: 'Velocidade'`, `category: 'rede'`, `protected: true`, `component: lazy(() => import('../pages/SpeedTestPage'))`.

- [ ] **Step 1: Write the failing tests**

Em `src/pages/SpeedTestPage.test.tsx` (`// @vitest-environment jsdom`), mock `../contexts/SpeedContext` com store hoisted. Afirme:

- estado `idle`: título “Teste de Velocidade”, botão “Iniciar” e zeros no medidor;
- estado `measuring`: botão “Cancelar”, texto da fase e barra de progresso;
- estado `done`: “Download”, “Upload”, “Ping”, “Jitter” com os valores do resultado e botão “Testar novamente”;
- estado `error`: `role="alert"` com a mensagem e botão “Tentar novamente” que chama `start()`;
- clique em “Iniciar” chama `start()`.

Em `src/routes/config.test.ts`, adicione:

```ts
it('tem Velocidade como pagina propria na categoria Rede', () => {
  const route = ROUTES.find((r) => r.path === '/velocidade');
  expect(route?.label).toBe('Velocidade');
  expect(route?.category).toBe('rede');
  expect(route?.protected).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/pages/SpeedTestPage.test.tsx src/routes/config.test.ts`
Expected: FAIL (módulos/rota ausentes).

- [ ] **Step 3: Implement page, route and docs**

- `SpeedTestPage.tsx`: monta `SpeedProvider` localmente; header “Teste de Velocidade”; card central com `SpeedGauge` (valor = `currentMbps ?? 0`, `progress`, `phase`, `active = status === 'measuring'`) e botão condicional Iniciar/Cancelar/Testar novamente; cards de Download/Upload/Ping/Jitter; `Progress` com `ariaLabel="Progresso do teste"`; erro com `role="alert"` e botão “Tentar novamente”.
- `config.ts`: importar `Activity` do lucide-react e inserir a rota depois de `/dns`.
- `README.md`: registrar a nova página na seção Rede e DNS.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/pages/SpeedTestPage.test.tsx src/routes/config.test.ts`
Expected: PASS (5 testes de página + testes de rota).

- [ ] **Step 5: Gate, build e commit**

```bash
bun run lint && bun run typecheck && bun run test && bun run build
git add src/pages/SpeedTestPage.tsx src/pages/SpeedTestPage.test.tsx src/routes/config.ts src/routes/config.test.ts README.md
git commit -m "feat: pagina de teste de velocidade da internet"
```

Expected: gate verde, build sem avisos, nenhum `.env.local` no staging.
