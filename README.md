# FM Optimize

[![site](https://img.shields.io/badge/site-fmoptimize-0044ff?style=for-the-badge)](https://fmoptimize.vercel.app)

41 tweaks de otimização do Windows em um único app desktop. Tudo embutido em um executável.

---

## Funcionalidades

- **Dashboard** — CPU, GPU, memória, armazenamento com barra de uso e tempo de atividade
- **Tweaks de otimização** — Utilitários, Limpeza, Rede, Apps, Input Lag, Processador (Intel/AMD)
- **Debloat de apps** — Discord (Equicord + plugin FakeNitro) e Spotify (Spicetify com Marketplace e bloqueador de anúncios), ambos com opção de reverter. O debloat do Spotify funciona mesmo com o FM Optimize aberto como administrador: ele reabre sozinho em uma janela sem privilégios
- **Armazenamento** — Limpeza de Disco do Windows e otimizações de SSD que só aparecem quando há um SSD detectado no sistema
- **Rede** — benchmark de DNS com ordenação por latência e aplicação automática + tweaks de otimização de internet
- **Limpeza** — limpeza de arquivos temporários, cache de navegadores e atualizações do Windows, com contagem de arquivos, tamanho por categoria e atualização em tempo real
- **Processador** — detecção automática de fabricante (Intel/AMD) com tweaks específicos
- **Emuladores** — debloat de emuladores Android (BlueStacks 4/5) com seleção de instância, lista de apps com ícones e nomes, presets de bloatware, backup e remoção via ADB. Permite desinstalar **qualquer** app, inclusive de sistema/críticos, com backup automático desses antes da remoção e histórico de apps removidos com restauração por instância (dados preservados via `pm uninstall -k` + `install -r`; backups em `%APPDATA%\fm-optimize\backups\<instância>\`). Apps protegidos que não podem ser desinstalados são desabilitados via `pm disable-user` e reativados com `pm enable`
- **Restore Points** — crie, liste, gerencie e restaure backups do Windows (criação automática opcional antes de executar tweaks)
- **Histórico de Execução** — registro de todos os tweaks executados com duração e status
- **Notificações** — toast de confirmação ao finalizar a execução de um tweak (com som opcional)
- **Mini-guia** — explicação simples do que cada tweak faz e quando usar
- **Atualização integrada** — botão nas Configurações que baixa e instala novas versões do GitHub
- **Bloqueio de Páginas** — nas Configurações, oculte páginas da barra lateral (Emuladores bloqueado por padrão) e proteja-as com senha mestra criptografada (DPAPI)
- **Janela customizada** — controles de minimizar/fechar customizados, sem barra de título nativa do Windows
- **Tema** — dark azul neon com fundo de circuito animado

---

## Tecnologias

Electron 35 · React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion

Tipografia **Inter Variable** (com eixo óptico `opsz` 14–32) e **JetBrains Mono Variable**, empacotadas no app via `@fontsource` — sem CDN e sem requisição externa em runtime.

---

## Segurança

O app executa comandos PowerShell no sistema. Todo dado que entra via IPC é validado (Zod) e passa por rate-limit antes de tocar o sistema. Comandos usam argumentos parametrizados e escapados (`psEscape`) para bloquear injeção. A elevação de privilégios usa allowlist de tweaks e revalidação de argumentos. Veja `docs/SECURITY.md`.

---

## Início rápido

```bash
npm install
npm run dev     # desenvolvimento
npm run build   # produção (gera em out/)
```

---

## Download

[fmoptimize.vercel.app](https://fmoptimize.vercel.app) · [GitHub Releases](https://github.com/FelipeMeloGomes/FM_Optimization/releases)

---

## Para desenvolvedores

Documentação técnica em `docs/`:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, fluxo IPC, providers modulares
- [SECURITY.md](docs/SECURITY.md) — controles de segurança e modelo de ameaça
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup, scripts, convenções, como adicionar handlers IPC

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (out/)
npm test         # testes do main process e do renderer (Vitest)
```
