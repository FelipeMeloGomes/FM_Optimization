# Arquitetura — FM Optimize

Visão geral da arquitetura do app desktop (Electron + React + TypeScript).

## Camadas

```
┌─────────────────────────────────────────────┐
│  Renderer (React)  — src/                    │
│  Contexts → Pages → Components               │
└───────────────┬─────────────────────────────┘
                │  window.electronAPI.*  (preload)
┌───────────────┴─────────────────────────────┐
│  Preload  — electron/preload/index.ts        │
│  contextBridge: ipc<T>() expõe API tipada    │
└───────────────┬─────────────────────────────┘
                │  ipcMain.handle('channel', ...)
┌───────────────┴─────────────────────────────┐
│  Main  — electron/main/                      │
│  ipc-handlers → services (PowerShell, etc.)  │
└─────────────────────────────────────────────┘
```

### Main (`electron/main/`)
- `ipc-handlers.ts` — registra todos os `ipcMain.handle`. Todo handler passa por `handleIpc(channel, input, fn)` que aplica **rate-limit** e **validação Zod** antes de executar.
- `services/powershell.ts` — `execPowerShellSafe` (comando + args parametrizados, escapados) e `execPowerShell` (scripts inline sanitizados).
- `services/rate-limit.ts` — janela deslizante por canal (ex: `elevate-app` 2/10s, `benchmark-dns` 3/5s).
- `validation.ts` + `branded-types.ts` — schemas Zod e tipos *branded* (`ScriptId`, `InterfaceIndex`, `RestorePointSeq`).
- `services/system-info.ts` — funções modulares (`getCpuInfo`, `getGpuInfo`, etc.) exportadas individualmente.
- `services/cpu-vendor.ts` — `normalizeCpuVendor` (função pura, sem I/O) e `getCpuIdentityOnce` (memoizado por processo, com dedupe de promise concorrente). Lê `si.cpu()` **uma única vez** e cacheia inclusive a falha, para não re-consultar o WMI a cada consumidor. `normalizeCpuVendor` resolve por `manufacturer` → `vendor` → `model`, então funciona sem o main carregar a dependência.

### Preload (`electron/preload/`)
- `ipc<T>(channel, ...args)` invoca `ipcRenderer.invoke` e retorna `data` ou rejeita com `error`.
- A API exposta está tipada em `ElectronAPI` (`electron/shared/ipc-types.ts`).

### Renderer (`src/`)
- **Providers modulares** (`src/contexts/`): `SystemContext` exporta providers por seção (`CpuProvider`, `GpuProvider`, `MemoryProvider`, `OsProvider`, `StorageProvider`) que carregam sob demanda. `DnsProvider` está encapsulado dentro da `NetworkPage` (lazy) para não rodar benchmark no startup.
- **Pages lazy**: todas as rotas em `App.tsx` usam `React.lazy()`.
- **Code-splitting**: `electron.vite.config.ts` separa vendors (`react`, `radix`, `lucide`) em chunks próprios.
- **Vendor de CPU é rótulo, não filtro**: `src/hooks/use-cpu-vendor.ts` é o único consumidor de `CpuInfo.vendor`. Ele combina a detecção com o override manual salvo em `settings.cpuVendorOverride`, aplicando a regra `detecção confiante sempre vence` — um override obsoleto nunca mascara uma detecção que funciona, ele só é consultado quando a detecção é `unknown`. `CpuPage` e `CommandPalette` consomem o hook; nenhum dos dois infere vendor por string.
- **Categoria `CPU` é única**: `getCpuCategories()` não recebe vendor e sempre devolve `['CPU']`. Os 37 scripts fundidos não diferem por fabricante, então filtrar por vendor apenas esconderia ajustes válidos — o hero da `CpuPage` continua exibindo o fabricante detectado. A tier de RAM (`getRamScriptId(ramGb)`) também não depende do vendor, o que garante recomendação mesmo com CPU não identificada.

## IDs de script legados

`electron/main/legacy-script-ids.ts` mapeia os 74 IDs retirados (`amd-1`…`amd-37`, `intel-1`…`intel-37`) para os 37 `cpu-N` que os fundiram. A resolução acontece em três guards do main — `getScriptById()`, o guard de `elevate-app` e `isValidScriptId()` do argumento `--elevate-script` — para que histórico, busca de conteúdo e execução elevada nunca quebrem com um ID antigo. `rewriteHistoryScriptIds()` roda uma vez em `loadUserData()` e persiste `scripts_data.json` se reescrever algo. O módulo pode ser removido depois da primeira release que inclua a migração.

## Cache do catálogo

`loadScripts()` memoiza `scripts.json` em memória. Em build empacotado o cache é permanente: o arquivo vive dentro do asar e não muda. **Em desenvolvimento o cache é revalidado por `mtime`**, porque o arquivo é editado em disco enquanto o processo main continua no ar — sem isso, o renderer hot-reload filtra pela categoria nova enquanto o main segue servendo o catálogo antigo, e a página renderiza vazia sem nenhum erro visível. É um bug que só aparece com processo de longa duração + arquivo editado por fora: nenhum teste unitário que leia o arquivo direto ou suba um processo fresco vai pegá-lo. Para validar a mudança, edite `resources/scripts.json` com o dev no ar e confirme que `/cpu` reflete o novo conteúdo.

## Fluxo de uma ação (ex: aplicar DNS)

1. `NetworkPage` chama `useDnsContext().applyDns(provider)`.
2. Preload `applyDns(interfaceIndex, addresses)` → `ipcRenderer.invoke('apply-dns', ...)`.
3. Main `handleIpc('apply-dns', ...)` → rate-limit + `applyDnsSchema` (Zod) valida IPv4.
4. `execPowerShellSafe('Set-DnsClientServerAddress', [...])` (args escapados).
5. Resultado volta ao renderer via Promise.

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `electron/main/ipc-handlers.ts` | Registro e pipeline de handlers IPC |
| `electron/main/validation.ts` | Schemas Zod de entrada IPC |
| `electron/main/branded-types.ts` | Tipos branded de domínio |
| `electron/main/services/powershell.ts` | Execução segura de PowerShell |
| `electron/main/services/rate-limit.ts` | Rate-limit por canal |
| `src/contexts/SystemContext.tsx` | Providers modulares de sistema |
| `src/pages/NetworkPage.tsx` | DNS benchmark + apply (encapsula DnsProvider) |
| `electron.vite.config.ts` | Build + manualChunks |
