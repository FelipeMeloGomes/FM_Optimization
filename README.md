<p align="center">
  <img src="resources/icon.svg" alt="FM Optimize" width="112" />
</p>

<h1 align="center">FM Optimize</h1>

<p align="center">
  <strong>68 scripts de otimização do Windows em um único app desktop.</strong><br />
  Desempenho, privacidade, limpeza e debloat em uma interface só.
</p>

<p align="center">
  <a href="https://fmoptimize.vercel.app"><img src="https://img.shields.io/badge/site-fmoptimize-0044ff?style=for-the-badge" alt="Site" /></a>
  <a href="https://github.com/FelipeMeloGomes/FM_Optimization/releases"><img src="https://img.shields.io/github/v/release/FelipeMeloGomes/FM_Optimization?style=for-the-badge&color=0044ff" alt="Última release" /></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows 10 e 11" />
  <img src="https://img.shields.io/badge/Electron-35-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron 35" />
</p>

---

**FM Optimize** reúne ajustes de desempenho, privacidade, limpeza e debloat do Windows em um app Electron para Windows 10/11. Cada script tem explicação, indicação de quando usar e registro do que já foi aplicado — sem caçar comando solto na internet.

> [!IMPORTANT]
> Algumas otimizações exigem privilégios de administrador. O app pede elevação quando necessário e mantém pendências da limpeza agendada para a próxima execução como admin. Crie um ponto de restauração antes de mexer no sistema — o app pode fazer isso automaticamente antes de cada tweak.

## Funcionalidades

### Otimização do Sistema

- **Dashboard** — uso de CPU, GPU, memória e armazenamento, tempo de atividade e quantos ajustes já estão aplicados (`N de 50`).
- **19 ajustes de otimização** — 12 de processador, 4 de GPU AMD e 3 de Windows (hardware, modo gamer e planos de energia). A seção de GPU tem card próprio com aviso de hardware.
- **Input Lag** — 6 ajustes de registro e resposta do sistema (todos os tweaks, USB, TCPNoDelay, prioridade, cache e atraso de menu). Os tweaks de teclado, mouse e monitor ficam em **Sistema**.
- **Inicialização** — apps, tarefas agendadas e serviços que abrem com o Windows, com interruptor reversível. Serviços essenciais ficam somente leitura.
- **Pontos de restauração** — criação, listagem e restauração de backups do Windows, com opção de criar automaticamente antes de executar tweaks.

### Manutenção

- **Limpeza** — lista item por item (temporários, Prefetch, Windows Update, shaders DirectX e cache de Chrome, Edge, Firefox e Brave) com tamanho em tempo real, seleção individual, atalho “Selecionar recomendados” (temporários, Prefetch e caches de navegador) e um botão único para limpar o que estiver marcado. A lista é virtualizada e acompanha a rolagem da página.
- **Limpeza automática** — agendamento diário, semanal ou mensal, com escolha das categorias. Com a automação ligada, fechar a janela libera a memória dela e o app continua na bandeja (~90 MB, sem renderer), podendo iniciar com o Windows já escondido e voltar na última página ao ser reaberto. Scripts finalizados com a janela fechada avisam por notificação nativa do Windows.
- **Utilitários** — manutenção do sistema e gerenciamento de memória e processos.
- **Armazenamento** — Limpeza de Disco do Windows, limpeza do WinSxS, otimizações de SSD e compactação do sistema; os tweaks exclusivos de SSD aparecem apenas quando um SSD é detectado.
- **Reparo do sistema** — SFC Scannow, DISM RestoreHealth e CHKDSK (Verificar Disco).
- **Privacidade** — telemetria, ID de anúncio, reconhecimento de fala e Timeline; bloqueio de domínios via arquivo Hosts e da instalação forçada de apps sugeridos pelo Windows.
- **Emuladores** — debloat de BlueStacks 4/5 via ADB: seleção de instância, presets de bloatware, backup automático do APK e restauração por instância. Permite remover qualquer app, inclusive de sistema.

### Formatação

- **Debloat** — inventário dos apps Appx instalados e provisionados, um por linha, com busca, abas (Todos, Recomendados e Protegidos), atalho “Selecionar recomendados”, seleção individual ou em lote e remoção confirmada. A lista é virtualizada e acompanha a rolagem da página. Os nomes vêm do manifesto do Windows; componentes de sistema com nome GUID são identificados pelo caminho de instalação, em vez de aparecerem como texto quebrado. Apps de sistema, frameworks, drivers de placa de vídeo (AMD, Intel e NVIDIA) e componentes marcados como não removíveis aparecem com cadeado e são recusados pelo main mesmo se a interface insistir. Sem administrador é possível selecionar itens para consulta, mas a remoção fica bloqueada e a página oferece reiniciar como admin.
- **Essenciais PC** — instalação via winget de CPU-Z, HWMonitor, MSI Afterburner, 7-Zip, WinRAR, Brave, qBittorrent, DirectX (runtime legado) e BCUninstaller, com progresso na própria página. O winget baixa do canal oficial e confere o hash do manifesto antes de rodar o instalador.
- **Personalização** — barra de tarefas e menu Iniciar limpos, menu de contexto clássico, animações, transparência e efeitos visuais. Inclui os mods de Discord (Equicord + FakeNitro) e Spotify (Spicetify), cada um com o card de reverter ao lado.

### Rede e DNS

- **DNS** — página própria com 19 provedores (privacidade, segurança, bloqueio de anúncios e controle parental), benchmark de latência com varredura animada provedor a provedor, provedor em uso fixado no topo da lista, ordenação dos demais por velocidade, aplicação do melhor e indicador de DNS ativo.
- **Velocidade** — teste real de internet com medidor animado: mede download, upload, ping e jitter contra a rede de servidores do Speedtest.net (o servidor mais próximo é escolhido automaticamente), move a agulha em tempo real com transições suaves entre fases e mantém o resultado final na tela. Sem histórico e sem salvar medições.
- **Internet** — tweaks para reduzir latência e melhorar a estabilidade da conexão, apresentados em seções virtualizadas.

### Sistema

- **Mouse** — página própria com os 2 tweaks de mouse que saíram do Input Lag (`inputlag-2` e `inputlag-11`). A lista de tweaks abre só quando você quer. O painel **Ajustes do Windows** lê e aplica, via `SystemParametersInfo`, a velocidade do ponteiro (1–20), a aceleração (**Melhorar precisão do ponteiro**) e o tempo de duplo clique (100–5000 ms) — os mesmos valores do painel do Windows, com botões **Aplicar**, **Restaurar padrão** e **Cancelar alterações**. O cursor do cabeçalho é decorativo e uma prévia com rastro responde ao movimento real do mouse dentro do painel.
- **Monitor** — página própria com o tweak de latência do driver de vídeo (`inputlag-3`), executado direto. O painel **Ajustes do Windows** enumera **todos os monitores ativos** (`EnumDisplayDevices` + `EnumDisplaySettingsEx`), mostra um card por monitor com seus modos reais e permite escolher resolução e taxa de atualização de cada um, aplicando com `ChangeDisplaySettingsEx` e persistindo a mudança no registro. O monitor do cabeçalho é decorativo.
- **Teclado** — página própria com os 2 tweaks de teclado (`inputlag-1` e `inputlag-9`). O painel **Ajustes do Windows** lê e aplica via `SystemParametersInfo` o atraso até repetir (250–1000 ms), a velocidade de repetição (0–31) e a piscagem do cursor (`SetCaretBlinkTime` + `CursorBlinkRate`, 100–2500 ms), com prévia visual dos três ajustes. O teclado do cabeçalho é decorativo.

**Banners animados:** o componente reutilizável `HeroBanner` (`src/components/hero/HeroBanner.tsx`) centraliza o gradiente e o slot do visual animado; cada página passa seu próprio conteúdo e um visual de `src/components/hero/AnimatedHero.tsx`. Todas as páginas têm um visual decorativo próprio no cabeçalho (painel, CPU, limpeza, debloat, DNS, rede, velocidade, emuladores, essenciais, histórico, input lag, personalização, privacidade, restauração, configurações, inicialização e utilitários), no mesmo estilo do cursor do Mouse, do monitor e do teclado. São animações CSS puras: não executam scripts, não leem nem alteram configuração do Windows e são ignoradas por leitores de tela (`aria-hidden`).

### Configurações

- **Histórico de execução** — duração, status e origem (manual ou agendada) de cada tweak. Cards aplicados ganham o selo **Aplicado**, inclusive os scripts interativos: o app espera a janela fechar e registra o código de saída real (menu fechado sem aplicar ou handoff sem desfecho fica como `—`, e fechar o console do Spotify aparece como **Interrompido pelo usuário**, não como erro).
- **Bloqueio de páginas** — oculte páginas da barra lateral e proteja-as com senha mestra criptografada via DPAPI (Emuladores bloqueado por padrão).
- **Atualização integrada** — download e instalação de novas versões direto do GitHub.
- **Interface** — temas claro/escuro, janela sem barra de título nativa, notificações com som opcional, mini-guia por tweak e paleta de comandos (`Ctrl+K`). Histórico, inicialização, Limpeza, Debloat e os cards de tweaks (Desempenho, Privacidade, Personalização e Rede) usam listas virtualizadas: só as linhas visíveis são renderizadas, com a rolagem feita pela página.
- **Atalhos** — `Ctrl+1`…`Ctrl+9` navegam entre páginas e `Ctrl+,` abre as Configurações.

## Tecnologias

| Camada      | Stack                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Desktop     | Electron 35, electron-vite, electron-builder, electron-updater         |
| Interface   | React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide, React Router 7 |
| Listas      | TanStack Virtual (`@tanstack/react-virtual`)                           |
| Dados e IPC | Zod, `systeminformation`, contextBridge com API tipada                 |
| Qualidade   | Vitest, Biome                                                          |

Tipografia **Inter Variable** e **JetBrains Mono Variable** empacotadas via `@fontsource` — sem CDN e sem requisição externa em runtime.

## Como funciona

O renderer (React) é tratado como não confiável. Toda chamada passa pelo preload e chega ao processo principal por IPC, onde é validada com Zod e limitada por rate-limit antes de executar qualquer comando no sistema.

```
Renderer (React)  →  Preload (contextBridge)  →  Main (IPC + Zod + rate-limit)  →  PowerShell
```

Os tweaks usam argumentos parametrizados e escapados (`psEscape`), e a elevação de privilégios passa por uma allowlist de scripts. Detalhes em [SECURITY.md](docs/SECURITY.md).

> [!NOTE]
> Ajustes que enfraquecem proteções do sistema ficaram de fora. Os comandos que desligavam a DEP (`bcdedit /set nx optout`) e a fonte de entropia do TPM (`bcdedit /set tpmbootentropy ForceDisable`) foram removidos do catálogo.

## Início rápido

Requisitos: **Windows 10/11**, **Node.js 20+** e **bun**.

```bash
git clone https://github.com/FelipeMeloGomes/FM_Optimization.git
cd FM_Optimization
bun install
bun run dev
```

Para gerar a build de produção em `out/`:

```bash
bun run build
```

### Instalador

```bash
npx electron-builder --win          # instalador + latest.yml
npx electron-builder --win nsis     # apenas o instalador
```

O instalador fica em `dist/fm-optimize-setup.exe`.

O `electron-builder.yml` usa uma **whitelist** de `files` (`out/`, `package.json` e `node_modules/`), então nada além do app compilado entra no `app.asar` — nem `data/`, nem `.env*`, nem artefatos de build. As únicas dependências de produção são as que o main process realmente carrega (`electron-updater`, `systeminformation`, `zod`); o renderer é empacotado pelo Vite. O hook `scripts/after-pack.cjs` remove do pacote o `dxcompiler.dll` (24,6 MB), que só é usado pelo caminho WebGPU/D3D12 — o app renderiza via D3D11.

## Scripts

| Comando             | Descrição                                     |
| ------------------- | --------------------------------------------- |
| `bun run dev`       | Desenvolvimento com hot reload                |
| `bun run build`     | Build de produção em `out/`                   |
| `bun run typecheck` | Typecheck do main process e do renderer       |
| `bun run lint`      | Biome (check)                                 |
| `bun run lint:fix`  | Biome (correção automática)                   |
| `bun run format`    | Formatação com Biome                          |
| `bun run test`      | Testes do main process e do renderer (Vitest) |

Antes de commitar: `bun run lint && bun run typecheck && bun run test`.

O Biome cobre TypeScript, JSON, CSS e **Markdown**: os `.md` do repositório entram no `lint`/`format`, com tabelas alinhadas e blocos de código embutidos formatados.

## Download

- [fmoptimize.vercel.app](https://fmoptimize.vercel.app)
- [GitHub Releases](https://github.com/FelipeMeloGomes/FM_Optimization/releases)

## Documentação

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, fluxo IPC e providers modulares
- [SECURITY.md](docs/SECURITY.md) — controles de segurança e modelo de ameaça
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup, convenções e como adicionar handlers IPC
- [OPTIMIZATION.md](docs/OPTIMIZATION.md) — redução do instalador (255,8 → 102,3 MB) e contrato de empacotamento
- [RUNTIME.md](docs/RUNTIME.md) — consumo medido com a janela aberta e na bandeja

## Estrutura do projeto

```
electron/
  main/        # handlers IPC, serviços PowerShell, execução e agendador
  preload/     # contextBridge e API tipada
  shared/      # contratos de IPC
src/
  pages/       # uma página por rota
  contexts/    # estado de sistema, scripts, histórico e configurações
  components/  # UI reutilizável
resources/
  scripts.json # catálogo dos 68 scripts
  icon.svg
```
