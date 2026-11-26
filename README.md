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

As oito páginas de tweaks (Input Lag, Otimização do sistema, Personalização, Internet, Armazenamento, Privacidade, Reparo do Sistema e Utilitários) usam seleção múltipla no mesmo padrão da Limpeza: uma única lista de tweaks, sem cards nem agrupamento por seção, com **Selecionar todos**, **Limpar seleção** e **Aplicar selecionados**. Nenhum tweak vem marcado por padrão; os tweaks escolhidos rodam em sequência e os scripts interativos abrem janela própria. Se o catálogo falhar, a página oferece **Tentar novamente** para recarregar os tweaks; os ícones dos selos são decorativos e ignorados por leitores de tela.

- **Otimizar PC** — análise sob demanda (nada roda no startup) do estado atual contra um plano curado de 16 ajustes persistentes. Mostra um **índice de otimização de 0 a 10**, o total de ajustes aplicados, o detalhamento por área com cobertura e índice separados e a lista de pendências com nome, descrição e risco. **Aplicar otimizações** cria um ponto de restauração único para o lote, executa apenas as pendências em sequência, mostra progresso, continua se um ajuste falhar e reanalisa ao terminar. A nota mede aderência ao plano — não é benchmark. Ajustes que o Windows não permite verificar aparecem como “Não verificado” e ficam fora do cálculo. Sem admin, a página oferece reiniciar como administrador.
- **Dashboard** — uso de processador, placa de vídeo, memória RAM e armazenamento, com a unidade identificada como SSD NVMe, SSD ou HD, tempo de atividade e quantos ajustes já estão aplicados (`N de 50`).
- **19 ajustes de otimização** — 12 de processador, 4 de GPU AMD e 3 de Windows (hardware, modo gamer e planos de energia), todos na mesma lista de tweaks.
- **Input Lag** — 5 ajustes de registro e resposta do sistema (USB, TCPNoDelay, prioridade, cache e atraso de menu). Os tweaks de teclado, mouse e monitor ficam em **Sistema**.
- **Inicialização** — apps, tarefas agendadas e serviços que abrem com o Windows, com interruptor reversível. Serviços essenciais ficam somente leitura.
- **Pontos de restauração** — criação, listagem e restauração de backups do Windows, com opção de criar automaticamente antes de executar tweaks.

### Manutenção

- **Limpeza** — lista item por item (temporários, Prefetch, Windows Update, shaders DirectX e cache de Chrome, Edge, Firefox e Brave) com tamanho em tempo real, seleção individual, atalho “Selecionar recomendados” (temporários, Prefetch e caches de navegador) e um botão único para limpar o que estiver marcado. A lista é virtualizada e acompanha a rolagem da página.
- **Limpeza automática** — agendamento diário, semanal ou mensal, com escolha das categorias. Com a automação ligada, fechar a janela libera a memória dela e o app continua na bandeja (~90 MB, sem renderer), podendo iniciar com o Windows já escondido e voltar na última página ao ser reaberto. Scripts finalizados com a janela fechada avisam por notificação nativa do Windows.

### Formatação

- **Debloat** — inventário dos apps Appx instalados e provisionados, um por linha, com busca, abas (Todos, Recomendados e Protegidos), atalho “Selecionar recomendados”, seleção individual ou em lote e remoção confirmada. A aba Todos lista apenas os apps removíveis; apps de sistema, frameworks, drivers de placa de vídeo (AMD, Intel e NVIDIA), componentes marcados como não removíveis e pacotes com nome GUID ficam só na aba Protegidos, com cadeado, e são recusados pelo main mesmo que a interface insista. A lista é virtualizada e acompanha a rolagem da página. Os nomes vêm do manifesto do Windows; componentes de sistema com nome GUID são identificados pelo caminho de instalação, em vez de aparecerem como texto quebrado. Sem administrador é possível selecionar itens para consulta, mas a remoção fica bloqueada e a página oferece reiniciar como admin.
- **Essenciais PC** — instalação via winget de CPU-Z, HWMonitor, MSI Afterburner, 7-Zip, WinRAR, Brave, qBittorrent, DirectX (runtime legado), BCUninstaller e Windhawk (mods de personalização), com progresso na própria página. O winget baixa do canal oficial e confere o hash do manifesto antes de rodar o instalador.
- **Personalização** — barra de tarefas e menu Iniciar limpos, menu de contexto clássico, animações, transparência e efeitos visuais. Inclui os mods de Discord (Equicord + FakeNitro) e Spotify (Spicetify), cada um com o selo de reverter.

### Rede e DNS

- **DNS** — página própria com 19 provedores (privacidade, segurança, bloqueio de anúncios e controle parental), benchmark de latência com varredura animada provedor a provedor, provedor em uso fixado no topo da lista, ordenação dos demais por velocidade, aplicação do melhor e indicador de DNS ativo.
- **Velocidade** — teste real de internet com medidor animado: mede download, upload, ping e jitter contra a rede de servidores do Speedtest.net (o servidor mais próximo é escolhido automaticamente), move a agulha em tempo real com transições suaves entre fases e mantém o resultado final na tela. Sem histórico e sem salvar medições.
- **Internet** — tweaks para reduzir latência e melhorar a estabilidade da conexão, apresentados em uma única lista virtualizada.

### Ferramentas

- **Comparar Placas** — comparador nativo de placas de vídeo com busca por nome nos dois seletores, tabela de especificações lado a lado e barras de desempenho relativo. A placa detectada no PC abre na Placa A com o selo **Detectada**; se ela não estiver no catálogo, o app a busca no [Technical City](https://technical.city/pt/gpu) e inclui na comparação da sessão. Os dados vêm de um catálogo público versionado (`resources/gpu-dataset.json`), servido por CDN e carregado no processo principal; enquanto o arquivo não estiver publicado no branch `main` (ou se a rede falhar), o app usa o cache local ou o dataset incluído no instalador. As pontuações são do PassMark e as especificações foram coletadas do Technical City, com link para a fonte no rodapé da página.
- **Overlay de jogo** — pill translúcido e mínimo (número + `FPS`) com o **FPS real** do jogo, capturado pelo [PresentMon](https://github.com/GameTechDev/PresentMon) 2.3.1 (MIT). Cadastre cada jogo escolhendo o `.exe`; o app descobre o processo e inicia a captura sozinho ao abrir o jogo, sem precisar abrir a página. O botão **Iniciar** no card abre esse executável direto, sem passar pela Steam — como o atalho usa o `.exe` escolhido, plataformas podem não registrar tempo de jogo ou conquistas. A engrenagem única da página ajusta o atalho global (padrão `Ctrl+Shift+F`, gravável), a posição, a opacidade, o FPS alvo (verde acima, vermelho abaixo) e a opção **mostrar somente quando o jogo estiver em foco**. A prévia acompanha posição, opacidade e cor do FPS alvo em tempo real, antes mesmo de salvar. O atalho mostra/oculta o pill; com o foco ligado ele desaparece no Alt+Tab, e desligado permanece visível enquanto o jogo estiver aberto. A média suavizada usa cerca de 1 s de amostras para não piscar a cada frame.

  **Requisitos:** Windows, jogo em **borderless em tela cheia** (tela cheia exclusiva não é suportada) e privilégio de administrador ou associação ao grupo _Performance Log Users_ — se faltar, a página mostra o aviso e oferece reiniciar elevado reaproveitando o fluxo já usado pelo app. Para o Batman Arkham Knight, a página lê `GFXSettings.BatmanArkhamKnight.xml`: se o jogo estiver em tela cheia exclusiva, aparece um aviso com o botão **Usar borderless**, que guarda um backup (`.bak`) e troca apenas o valor `Display_Mode` de `2` para `1`; basta reiniciar o jogo. O binário do PresentMon é baixado na primeira captura e validado por SHA256. Com vários jogos cadastrados abertos, apenas o jogo em foco é capturado; os outros aparecem como "rodando" na página. As capas vêm da Steam sem chave de API: o app descobre o `appid` pelos `appmanifest` instalados ou pela busca da loja, baixa `library_600x900.jpg` e guarda em `%APPDATA%\fm-optimize\covers\`; jogos fora da Steam usam as iniciais. Enquanto houver jogos habilitados, o app permanece na bandeja ao fechar a janela.

### Sistema

Na barra lateral, **Meu PC, Monitor, Mouse e Teclado** aparecem nessa ordem; os demais itens seguem em ordem alfabética.

- **Armazenamento** — o painel **Ajustes do Windows** mostra um card por unidade com uso em porcentagem, capacidade total, espaço livre e o tipo de mídia (SSD NVMe, SSD ou HD), no mesmo padrão de prévia e controles do Monitor. Cada disco tem **Limpeza de disco** (`cleanmgr`) e, só em SSD, **Otimizar SSD** (`defrag /O /L`); o TRIM entra na limpeza em lote quando você marca **Incluir otimização SSD (TRIM)** e seleciona unidades. As ferramentas abrem janela própria e exigem administrador. O banner mostra uma ilustração de SSD NVMe M.2 com brilho e descrição animados, no mesmo padrão de Mouse, Monitor e Teclado, e fica acima do painel **Ajustes do Windows**. Abaixo seguem os tweaks de Limpeza de Disco do Windows, limpeza do WinSxS, otimizações de SSD e compactação do sistema; os tweaks exclusivos de SSD aparecem apenas quando um SSD é detectado.
- **Emuladores** — debloat de BlueStacks 4/5 via ADB: seleção de instância, presets de bloatware, backup automático do APK e restauração por instância. Permite remover qualquer app, inclusive de sistema.
- **Meu PC** — hardware lido direto do Windows: processador, caches (L1/L2/L3), placa-mãe, memória, slots de memória, placa de vídeo e armazenamento, com a unidade identificada como SSD NVMe, SSD ou HD. O banner segue o mesmo padrão de Monitor: ilustração de gabinete de PC desktop com iluminação RGB, brilho interativo e descrição animada. Em **Itens do sistema**, os 9 nomes ficam lado a lado numa faixa com rolagem horizontal e setas; os rótulos entram em cascata e o painel desliza ao trocar de nome, respeitando `prefers-reduced-motion`. Clicar em um nome mostra só os campos daquele item no painel abaixo, em lista contínua de rótulo e valor. Estão incluídos sistema operacional (nome, versão, build, edição e data de instalação) e tempo de atividade. Família, modelo, stepping e clock do processador vêm da consulta consolidada do Windows, e a edição do Windows é extraída do nome do sistema (por exemplo, **Pro**), em vez de repetir o número da versão. Quando o Windows não informa um dado, o painel diz **Não informado/Não informada** ou **Sem rótulo** em vez de um travessão; a placa-mãe passa a mostrar também versão e data da BIOS, e os ícones de **Componentes** usam a cor de destaque do tema. O botão **Exportar relatório...** gera os dois relatórios (hardware e bateria) na Área de Trabalho, sem menu de opções.
- **Privacidade** — telemetria, ID de anúncio, reconhecimento de fala e Timeline; bloqueio de domínios via arquivo Hosts e da instalação forçada de apps sugeridos pelo Windows.
- **Reparo do sistema** — SFC Scannow, DISM RestoreHealth e CHKDSK (Verificar Disco).
- **Utilitários** — manutenção do sistema e gerenciamento de memória e processos, na mesma lista única com seleção múltipla das demais páginas de tweaks. O relatório de sistema saiu daqui e agora fica em **Meu PC**.
- **Mouse** — página própria com os 2 tweaks de mouse que saíram do Input Lag (`inputlag-2` e `inputlag-11`). A lista de tweaks abre só quando você quer. O painel **Ajustes do Windows** lê e aplica, via `SystemParametersInfo`, a velocidade do ponteiro (1–20), a aceleração (**Melhorar precisão do ponteiro**) e o tempo de duplo clique (100–5000 ms) — os mesmos valores do painel do Windows, com botões **Aplicar**, **Restaurar padrão** e **Cancelar alterações**. O banner traz uma ilustração de mouse gamer com iluminação RGB, brilho e descrição animados, e uma prévia com rastro responde ao movimento real do mouse dentro do painel.
- **Monitor** — página própria com o tweak de latência do driver de vídeo (`inputlag-3`), executado direto. O painel **Ajustes do Windows** enumera **todos os monitores ativos** (`EnumDisplayDevices` + `EnumDisplaySettingsEx`), mostra um card por monitor com seus modos reais e permite escolher resolução e taxa de atualização de cada um, aplicando com `ChangeDisplaySettingsEx` e persistindo a mudança no registro. O banner traz uma ilustração de monitor gamer com iluminação RGB, brilho e descrição animados.
- **Teclado** — página própria com os 2 tweaks de teclado (`inputlag-1` e `inputlag-9`). O painel **Ajustes do Windows** lê e aplica via `SystemParametersInfo` o atraso até repetir (250–1000 ms), a velocidade de repetição (0–31) e a piscagem do cursor (`SetCaretBlinkTime` + `CursorBlinkRate`, 100–2500 ms), com prévia visual dos três ajustes. O banner traz uma ilustração de teclado gamer com iluminação RGB, brilho e descrição animados.

**Banners ilustrados:** todas as páginas usam o mesmo `HeroBanner` (`src/components/hero/HeroBanner.tsx`), com uma ilustração SVG local exibida inteira no lado direito (`object-contain`, banner de 192 px) e a descrição revelada palavra por palavra (`BlurText`, por meio de `HeroDescription` também nas páginas que passam o texto como `children`). O catálogo `src/lib/hero-art.ts` associa a arte e a descrição em português a cada uma das 26 rotas; o selo do cabeçalho e o ícone vêm do `path` em `src/routes/route-icons.ts`, a mesma fonte da barra lateral. Não há mais banner de ícone animado: cada rota traz um objeto físico desenhado com volume, perspectiva, gradientes, sombras e reflexos — periféricos, gabinete, SSD, roteador, servidor, cofre, arquivo, console, ferramentas e outros — com brilho interativo (`GlareHover`) via React Bits, em `src/components/react-bits/`: a faixa segue o cursor, usa a cor de destaque do tema e respeita `prefers-reduced-motion` consultado no momento da interação. Conteúdos dinâmicos (nome/build do Windows, contagem de pontos, GPU detectada e botão do overlay) seguem dentro do banner como `children`. Os valores numéricos dos ajustes dessas páginas giram suavemente até o novo número quando você arrasta um slider ou troca o modo do monitor (`AnimatedNumber`, também em `src/components/ui/`), sem alterar a configuração aplicada; o valor final continua anunciado de imediato para leitores de tela. Os botões de atualização ficam em uma faixa única logo abaixo do banner (`src/components/RefreshButton.tsx`), alinhados à direita e fora da animação, com o mesmo visual `outline` e ícone girando durante a carga. A faixa zera só as margens laterais do `fieldset` e herda o espaçamento vertical do contêiner `space-y-6`, mantendo os 24 px até o card ou aviso seguinte. Na página **Inicio**, o indicador de saúde do sistema e o aviso de dados em cache ficam nessa faixa, à esquerda do botão, para não cobrirem a ilustração do banner.

### Configurações

- **Histórico de execução** — duração, status e origem (manual ou agendada) de cada tweak. Cards aplicados ganham o selo **Aplicado**, inclusive os scripts interativos: o app espera a janela fechar e registra o código de saída real (menu fechado sem aplicar ou handoff sem desfecho fica como `—`, e fechar o console do Spotify aparece como **Interrompido pelo usuário**, não como erro).
- **Bloqueio de páginas** — oculte páginas da barra lateral e proteja-as com senha mestra criptografada via DPAPI (Emuladores bloqueado por padrão).
- **Atualização integrada** — download e instalação de novas versões direto do GitHub; o número da versão aparece apenas no card **Atualizações**, fora do banner ilustrado.
- **Interface** — temas claro/escuro, janela sem barra de título nativa, notificações com som opcional, mini-guia por tweak e paleta de comandos (`Ctrl+K`). Cards, ícones e scrims dos diálogos seguem os tokens do tema, incluindo a janela independente do overlay de FPS. As oito páginas de tweaks (Input Lag, Otimização do sistema, Personalização, Internet, Armazenamento, Privacidade, Reparo do Sistema e Utilitários) exibem uma única lista virtualizada no padrão da Limpeza, com checkbox por linha e barra de seleção múltipla; a seleção começa vazia e os tweaks marcados são aplicados em sequência. Histórico, inicialização e Debloat também usam listas virtualizadas: só as linhas visíveis são renderizadas, com a rolagem feita pela página.
- **Cards em largura total** — a página Configurações ocupa toda a largura disponível, com os cards de Tema, Preferências, Bloqueio de Páginas, Dados, Notificações e Atualizações empilhados em uma única coluna, sem limitação de largura.
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

A build também grava `renderer-stats.html` na raiz do projeto com o relatório de tamanho dos bundles. Ele não abre o navegador automaticamente: abra o arquivo quando quiser inspecionar.

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

### Testando os tweaks com segurança

A página Otimizar PC lê o estado real com `reg query`, `netsh int tcp show global` e `powercfg`. As verificações são derivadas do conteúdo dos próprios scripts em `resources/scripts.json`, e a suíte roda contra `tests/fixtures/optimization/real-state.json`, capturado de um Windows real — inclusive ajustes que o sistema não reporta, que viram `unknown` em vez de “não aplicado”.

Em desenvolvimento (`bun run dev`) a página exibe **Modo simulação**: a análise continua real, mas aplicar não grava registro, não cria ponto de restauração e não executa scripts. O botão só existe fora do build instalado.

Para validar o efeito real de um ajuste sem risco, habilite o Windows Sandbox uma vez (pede reboot) e rode:

```powershell
.\scripts\test-tweaks.ps1 -Id tweaks-1
```

O script extrai o tweak e as verificações do catálogo real, roda tudo dentro do Sandbox com pastas mapeadas e imprime o ANTES/DEPOIS de cada chave com o veredito. Ao fechar o Sandbox, nada permanece no Windows. Para reboot ou persistência, use uma VM Hyper-V com checkpoint — só necessário para tweaks que pedem reinício.

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
- [COMPONENTIZACAO.md](docs/COMPONENTIZACAO.md) — candidatos a extração de componentes/hooks/utils
- [REFATORACAO-P1.md](docs/REFATORACAO-P1.md) — relatório das extrações do P1
- [REFATORACAO-P2.md](docs/REFATORACAO-P2.md) — relatório das extrações do P2
- [REFATORACAO-P3.md](docs/REFATORACAO-P3.md) — relatório das extrações do P3

## Licença

O FM Optimize é software **proprietário e fechado**. O código-fonte, a documentação e os recursos do projeto pertencem a Felipe Melo Gomes e não podem ser copiados, modificados ou redistribuídos sem autorização por escrito. Instalar o executável oficial concede apenas o direito de usá-lo — não concede acesso ao código-fonte. Os termos completos estão em [LICENSE](LICENSE).

## Créditos

Componentes de terceiros (Electron, React, Zod, Lucide, PresentMon, fontes Inter e JetBrains Mono) e as bases PassMark, Technical City e Steam são creditados na interface e listados com suas licenças em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). As ilustrações dos banners são SVGs locais criados para o projeto.

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
