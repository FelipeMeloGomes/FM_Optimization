# Otimização de empacotamento — FM Optimize

Registro da redução de tamanho do instalador (v2.19.1) e do contrato que impede
a regressão. O diagnóstico foi feito medindo o `app.asar` do build real, não o
bundle do renderer.

## Resumo

| Métrica                  | Antes     | Depois        | Redução    |
| ------------------------ | --------- | ------------- | ---------- |
| Instalador NSIS          | 255,8 MB  | **102,34 MB** | **−60,0%** |
| App instalado (unpacked) | ~752,0 MB | **291,3 MB**  | **−61,3%** |
| `app.asar`               | 395,2 MB  | **6,77 MB**   | **−98,3%** |
| `node_modules` no pacote | 101,8 MB  | **4,30 MB**   | −95,8%     |
| Pacotes no `app.asar`    | 219       | **18**        | −91,8%     |
| `data/backups` (APKs)    | 284,6 MB  | **0**         | −100%      |
| `locales/`               | 48,8 MB   | **1,2 MB**    | −97,5%     |
| `dxcompiler.dll`         | 24,6 MB   | **0**         | −100%      |
| `out/` compilado         | 3,4 MB    | **2,30 MB**   | −32%       |
| `.env.local` no pacote   | sim       | **não**       | —          |

## Diagnóstico

O `files` do `electron-builder.yml` só tinha negações, então valia o default
`**/*` e o pacote levava o repositório inteiro:

| Conteúdo        | Tamanho  | Por quê ia parar no pacote                       |
| --------------- | -------- | ------------------------------------------------ |
| `data/`         | 284,6 MB | APKs locais em `data/backups/` (não rastreados)  |
| `node_modules/` | 101,8 MB | `dependencies` acumulava pins e libs do renderer |
| `.env.local`    | —        | continha o `GITHUB_TOKEN` (vazamento)            |
| `out/`          | 3,4 MB   | correto                                          |

O JS do app é só **1,56 MB** (renderer) + **0,17 MB** (main). O gargalo era o
empacotamento, não o código.

## Mudanças aplicadas

### 1. Whitelist de `files`

```yaml
files:
  - out/**/*
  - package.json
  - node_modules/**/*
  - '!**/*.tsbuildinfo'
  - '!**/*.map'
  - '!**/.env*'
  - '!**/node_modules/zod/src/**'
```

Com whitelist, nada fora de `out/`, `package.json` e `node_modules/` entra no
asar — nem `data/`, nem `.env*`, nem artefatos de build.

### 2. `dependencies` só com o que o main carrega

Verificando os `require()` de `out/main/index.js`, o main process usa apenas
três pacotes externos: `electron-updater`, `systeminformation` e `zod`. Todo o
resto (pins de segurança e libs de renderer, que o Vite empacota) foi para
`devDependencies`. O `externalizeDepsPlugin` só externaliza `dependencies`, então
o renderer continua bundlado normalmente.

### 3. Locales e compressão

```yaml
electronLanguages: [pt-BR, en-US]
compression: maximum
```

Os 48 locales do Electron caíram para 2 arquivos.

### 4. Hook `afterPack` removendo `dxcompiler.dll`

`scripts/after-pack.cjs` apaga o `dxcompiler.dll` (24,6 MB) depois de copiar o
runtime. Ele só é carregado pelo caminho WebGPU/D3D12; o app renderiza via
D3D11 + `D3DCompiler_47.dll`. Validado em execução: o GPU process sobe com
`d3d11.dll` e sem erro. `vk_swiftshader`/`vulkan-1` ficam (fallback de GPU) e
`LICENSES.chromium.html` fica (obrigação legal).

### 5. Código-fonte TS do `zod`

O `zod` publica ~3 MB de TypeScript em `src/v4/**/*.ts` (testes inclusive), mas
a entrada é `index.cjs`. O filtro é **escopado ao zod** de propósito: o pacote
`debug` usa `src/index.js` como `main`, e um glob genérico de `src` derrubava o
boot do main process com `Cannot find module .../debug/src/index.js`.

## O que ficou de fora (piso técnico)

| Item                           | Tamanho  | Motivo                     |
| ------------------------------ | -------- | -------------------------- |
| `fm-optimize.exe` (Electron)   | 237,8 MB | binário do framework       |
| `resources.pak` + `icudtl.dat` | 23,1 MB  | núcleo do Chromium         |
| `LICENSES.chromium.html`       | 5,4 MB   | obrigação legal            |
| `vk_swiftshader` + `vulkan-1`  | 6,1 MB   | fallback de GPU sem driver |
| `d3dcompiler_47.dll`           | 4,5 MB   | shaders D3D11 (usado)      |
| `ffmpeg.dll`                   | 3,0 MB   | mídia do Chromium          |

Declarações `.d.ts`/`.d.cts` restantes somam 0,35 MB (< 0,1 MB comprimido) e não
justificam outro ciclo de build. O próximo salto de tamanho exigiria trocar de
runtime, não ajustar empacotamento.

## Contrato de regressão

`electron/main/tests/packaging-config.test.ts` trava o comportamento:

- `files` é whitelist e não usa `**/*`; `data/` e `.env*` ficam de fora.
- `dependencies` só contém pacotes importados pelo main; build/renderer ficam em
  `devDependencies`.
- `electronLanguages`, `compression: maximum` e `afterPack` configurados.
- Hook `afterPack`: remove `dxcompiler.dll`, preserva `d3dcompiler_47`,
  `vk_swiftshader`, `vulkan-1`, `resources.pak` e o executável; é idempotente e
  não mexe em outras plataformas.
- Conteúdo do `app.asar` (quando existe build local): `node_modules/debug/src/index.js`
  presente e `node_modules/zod/src/` ausente.
- `app.asar` abaixo de 40 MB.

Ciclo vermelho-verde comprovado para cada item: config antiga falha 6 testes, o
filtro genérico de `src` falha no `debug`, e o hook sem remoção falha 2 testes.

## Como verificar

```powershell
bun run lint && bun run typecheck && bun run test
bun run build
npx electron-builder --win
```

Depois do build, o log deve conter `removidos do pacote: dxcompiler.dll`, o
`app.asar` deve ter ~6,8 MB e o instalador ~102 MB. `dist/latest.yml` precisa
trazer a versão do `package.json`.
