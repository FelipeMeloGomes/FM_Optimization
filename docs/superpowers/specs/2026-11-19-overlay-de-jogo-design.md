# Overlay de jogo — desenho

Data: 2026-11-19

## Intenção

Mostrar o FPS real de um jogo dentro da tela, sem exigir que o usuário configure nada durante a partida. O usuário cadastra seus jogos uma vez na página **Overlay de jogo** (categoria Ferramentas) e o app cuida de detectar o jogo aberto, iniciar a captura e exibir o número. A página é o único lugar de configuração; durante o jogo tudo é controlado por um atalho.

## Por que

O usuário joga em tela cheia e quer ver o framerate sem sair da partida nem abrir ferramentas de terceiros. A experiência pedida é a de um contador discreto que "marca" o FPS, com configuração centralizada no app.

## Objetivos

- Cadastrar jogos apontando o executável (`.exe`), com capa automática quando disponível.
- Iniciar e parar a captura automaticamente quando um jogo cadastrado e habilitado abre e fecha.
- Exibir um overlay mínimo e legível com o FPS do jogo em foco.
- Permitir mostrar/ocultar o overlay com atalho global.
- Centralizar toda a configuração em uma engrenagem única na página.
- Falhar de forma clara e acionável quando faltar permissão ou ferramenta de captura.

## Não objetivos

- Não injetar DLL nem hackear o processo do jogo.
- Não funcionar em **tela cheia exclusiva** — apenas em janela/borderless. O Windows não permite janela por cima de exclusiva.
- Não gravar histórico, gráfico, percentis nem relatórios de desempenho.
- Não configurar overlay por jogo — a configuração é global.
- Não sincronizar lista de jogos com a nuvem nem com lojas além da Steam.
- Não burlar anti-cheat nem coletar dados do jogo além de eventos de apresentação de frame.

## Ant objetivos (o que seria uma falha mesmo funcionando)

- Mostrar FPS inventado, estimado ou "bonito".
- Roubar clique ou foco do jogo.
- Mostrar o overlay sobre janelas de outros jogos cadastrados, ou sobre qualquer janela quando a opção "somente em foco" estiver ligada. Com a opção desligada, é aceitável o overlay permanecer visível enquanto o jogo cadastrado estiver aberto, mesmo após alt-tab.
- Falhar silenciosamente por falta de privilégio, deixando o usuário sem entender por que não aparece nada.

## Restrições

- Windows, Electron + React + TypeScript; o renderer tem `connect-src 'self'`, então toda requisição HTTP e todo spawn de processo acontecem no **main process**.
- Dados do usuário ficam em `%APPDATA%\fm-optimize\`.
- Novo código precisa de teste que cobre comportamento real; correção de bug precisa de teste de regressão vermelho-verde.
- Gate antes de qualquer commit: `bun run lint && bun run typecheck && bun run test`.
- Interface e documentação em português.
- Nada de commit, push ou release sem pedido explícito.

## Decisões fechadas com o usuário

### Página e lista de jogos

- Rota nova na categoria **Ferramentas**, com nome visível **Overlay de jogo**.
- O usuário adiciona um jogo escolhendo o `.exe` em um seletor de arquivo nativo. O app infere o nome do processo e o nome do jogo; o usuário não digita nome de processo.
- Cada jogo da lista tem: capa, nome, nome do processo, interruptor de habilitado e status (parado / rodando com FPS atual).
- Capa: resolver o `appid` da Steam primeiro pelos `appmanifest_*.acf` instalados (`installdir` → `appid`), com fallback para `storesearch` por nome. Baixar `library_600x900.jpg` da CDN da Steam e guardar em cache local. Sem match ou sem rede, usar card com as iniciais. A busca de metadados não exige chave de API.
- Capturas de tela do app não são necessárias; a prévia do overlay fica na página.

### Captura de FPS

- Fonte: **PresentMon** (Intel, MIT), versão fixada, binário baixado do release do GitHub e verificado por SHA256 antes de usar, salvo em `%APPDATA%\fm-optimize\tools\`.
- Invocação com `--process_name <exe>` , `--output_stdout` (ou arquivo temporário), `--terminate_on_proc_exit` e opções para reduzir colunas. O CSV é lido incrementalmente no main process.
- O FPS exibido é uma **média suavizada de cerca de 1 segundo**, não o valor por frame.
- PresentMon exige administrador ou associação ao grupo local _Performance Log Users_. A página detecta a condição e mostra aviso com ação de relançar o **app** elevado, reaproveitando o fluxo existente de elevação e restaurando o monitoramento após o relançamento — em vez de falhar em silêncio. Não usar o `--restart_as_admin` do PresentMon, porque o processo elevado não herdaria o pipe de stdout usado para ler o CSV.

### Overlay

- Janela separada do Electron: transparente, `alwaysOnTop`, redimensionada ao monitor do jogo, `setIgnoreMouseEvents(true)` permanente — nenhum clique é capturado.
- Aparência: um pill escuro translúcido, canto superior esquerdo por padrão, somente o número e a palavra `FPS`, sem gráfico nem tempo de frame.
- Cor: verde acima do alvo, vermelho abaixo. Alvo padrão **60 FPS**, configurável.
- O overlay aparece quando o jogo cadastrado/habilitado está rodando. Com "mostrar somente quando o jogo estiver em foco" **ligado**, ele some se o jogo perder o foco; **desligado**, ele permanece visível enquanto o jogo estiver aberto, mesmo com outro app na frente. Fecha o jogo → some o overlay.
- Quando vários jogos cadastrados estão rodando, existe **uma captura por vez**, do jogo selecionado pelo critério de foco (ou o primeiro habilitado quando a opção de foco estiver desligada). Os demais jogos aparecem na lista apenas como "rodando", sem FPS.
- O monitoramento começa **com o app**, não depende da página estar aberta. Enquanto houver jogos habilitados cadastrados, o app permanece residente na bandeja mesmo com a janela principal fechada.
- Atalho global padrão: `Ctrl+Shift+F`, gravável na página, alterna mostrar/ocultar a janela do overlay. Em caso de conflito ao registrar, a página avisa.

### Configuração (engrenagem única no cabeçalho da página)

Painel com: atalho gravável, posição na tela (quatro cantos), opacidade (padrão 85%), FPS alvo (padrão 60) e opção "mostrar somente quando o jogo estiver em foco". Botão salvar. Todas as configurações são globais, persistidas em `%APPDATA%\fm-optimize\`.

## Partes a implementar

1. Tipos compartilhados e bridge IPC para: listar/adicionar/remover jogos, alternar habilitado, ler/salvar configurações, consultar status do capturador, elevar privilégio, buscar capa e assinar atualizações de FPS/estado do jogo.
2. Serviço no main process para persistir lista de jogos e configurações com validação zod.
3. Serviço de resolução de jogos: seleção de `.exe`, inferência de nome/processo, leitura de `appmanifest_*.acf`, busca `storesearch`, download e cache da capa.
4. Serviço de monitoramento de processos: detectar quais jogos cadastrados estão rodando e qual está em foco.
5. Serviço do PresentMon: garantir binário (download + SHA256), montar argumentos, iniciar/parar processo, parsear CSV e calcular FPS suavizado.
6. Janela do overlay com posição, opacidade e atalho global, sem interação de mouse.
7. Página React na categoria Ferramentas com lista de jogos, engrenagem, painel de configuração, avisos de permissão/ferramenta e prévia do pill.
8. Registro de rota, sidebar e README.
9. Testes para cada serviço, bridge e comportamento visível da página, incluindo casos de erro (sem permissão, binário ausente, jogo sem capa, falha de download, conflito de atalho).

## Decisões deixadas para o builder

- Nomes exatos de canais IPC, schemas zod e formatos de arquivo em disco.
- Estrutura interna dos serviços e estratégia de retry do download do PresentMon.
- Como representar a janela do overlay no ciclo de vida do app (criar sob demanda versus manter oculta).
- Mecanismo de obtenção do PID em foco no Windows usando as APIs já disponíveis no projeto.
- Detalhes de layout e componentes shadcn, mantendo a linguagem visual do FM Optimize e o mockup aprovado.
- Estratégia de teste para código que depende de processos do Windows e de rede, com injeção de dependências e mocks.

## Fora do desenho (decisões do usuário já aplicadas acima)

Nada. Todas as escolhas de produto foram fechadas na conversa; o que resta é execução.
