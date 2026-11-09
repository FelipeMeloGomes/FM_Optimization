<p align="center">
  <img src="resources/icon.svg" alt="FM Optimize" width="112" />
</p>

<h1 align="center">FM Optimize</h1>

<p align="center">
  <strong>100 scripts de otimização do Windows em um único app desktop.</strong><br />
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

### Desempenho

- **Dashboard** — uso de CPU, GPU, memória e armazenamento, tempo de atividade e quantos ajustes já estão aplicados (`N de 75`).
- **42 tweaks de desempenho** — 34 de processador, 4 de GPU AMD e 4 de Windows (energia, serviços, prioridade e modo de jogo). A seção de GPU tem card próprio com aviso de hardware.
- **Input Lag** — 11 ajustes de teclado, mouse, monitor, USB e resposta do sistema.
- **Inicialização** — apps, tarefas agendadas e serviços que abrem com o Windows, com interruptor reversível. Serviços essenciais ficam somente leitura.
- **Pontos de restauração** — criação, listagem e restauração de backups do Windows, com opção de criar automaticamente antes de executar tweaks.

### Manutenção

- **Limpeza** — arquivos temporários, cache de navegadores e atualizações do Windows, com contagem de arquivos e tamanho por categoria em tempo real.
- **Limpeza automática** — agendamento diário, semanal ou mensal, com escolha das categorias. Com a automação ligada, o app vai para a bandeja ao fechar e pode iniciar com o Windows já escondido.
- **Debloat** — remoção de bloatware do Windows (Cortana, OneDrive, Xbox, Copilot, Widgets) e dos apps Discord (Equicord + FakeNitro) e Spotify (Spicetify). O debloat de apps tem opção de reverter.
- **Personalização** — barra de tarefas e menu Iniciar limpos, menu de contexto clássico, animações, transparência e efeitos visuais.
- **Utilitários** — SFC, DISM, CHKDSK, TRIM de SSD, limpeza do WinSxS, compactação do sistema e outros comandos de manutenção.
- **Armazenamento** — Limpeza de Disco do Windows e otimizações de SSD, exibidas apenas quando um SSD é detectado.

### Programas

- **Essenciais PC** — instalação via winget de CPU-Z, HWMonitor, MSI Afterburner, DirectX (runtime legado), 7-Zip, WinRAR e BCUninstaller, com progresso na própria página. O winget baixa do canal oficial e confere o hash do manifesto antes de rodar o instalador.
- **Emuladores** — debloat de BlueStacks 4/5 via ADB: seleção de instância, presets de bloatware, backup automático do APK e restauração por instância. Permite remover qualquer app, inclusive de sistema.

### Rede

- **Benchmark de DNS** com ordenação por latência e aplicação do provedor escolhido.
- **Tweaks de internet** para reduzir latência e melhorar a estabilidade da conexão.

### Segurança e privacidade

- Telemetria, ID de anúncio, reconhecimento de fala e Timeline.
- Bloqueio de domínios via arquivo Hosts.
- Bloqueio da instalação forçada de apps sugeridos pelo Windows.

### Sistema

- **Histórico de execução** — duração, status e origem (manual ou agendada) de cada tweak. Cards aplicados ganham o selo **Aplicado**, inclusive os scripts interativos: o app espera a janela fechar e registra o código de saída real (menu fechado sem aplicar ou handoff sem desfecho fica como `—`).
- **Bloqueio de páginas** — oculte páginas da barra lateral e proteja-as com senha mestra criptografada via DPAPI (Emuladores bloqueado por padrão).
- **Atualização integrada** — download e instalação de novas versões direto do GitHub.
- **Interface** — tema dark azul neon com fundo de circuito animado, janela sem barra de título nativa, notificações com som opcional, mini-guia por tweak e paleta de comandos (`Ctrl+K`).
- **Atalhos** — `Ctrl+1`…`Ctrl+9` navegam entre páginas e `Ctrl+,` abre as Configurações.

## Tecnologias

| Camada      | Stack                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Desktop     | Electron 35, electron-vite, electron-builder, electron-updater         |
| Interface   | React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide, React Router 7 |
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

Requisitos: **Windows 10/11**, **Node.js 20+** e **npm**.

```bash
git clone https://github.com/FelipeMeloGomes/FM_Optimization.git
cd FM_Optimization
npm install
npm run dev
```

Para gerar a build de produção em `out/`:

```bash
npm run build
```

### Instalador

```bash
npx electron-builder --win          # instalador + latest.yml
npx electron-builder --win nsis     # apenas o instalador
```

O instalador fica em `dist/fm-optimize-setup.exe`.

## Scripts

| Comando             | Descrição                                     |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Desenvolvimento com hot reload                |
| `npm run build`     | Build de produção em `out/`                   |
| `npm run typecheck` | Typecheck do main process e do renderer       |
| `npm run lint`      | Biome (check)                                 |
| `npm run lint:fix`  | Biome (correção automática)                   |
| `npm run format`    | Formatação com Biome                          |
| `npm run test`      | Testes do main process e do renderer (Vitest) |

Antes de commitar: `npm run lint && npm run typecheck && npm run test`.

## Download

- [fmoptimize.vercel.app](https://fmoptimize.vercel.app)
- [GitHub Releases](https://github.com/FelipeMeloGomes/FM_Optimization/releases)

## Documentação

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, fluxo IPC e providers modulares
- [SECURITY.md](docs/SECURITY.md) — controles de segurança e modelo de ameaça
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup, convenções e como adicionar handlers IPC

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
  scripts.json # catálogo dos 100 scripts
  icon.svg
```
