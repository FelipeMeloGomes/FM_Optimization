# Internet Speed Test — design

**Data:** 2026-11-18

## Intenção

Dar ao FM-Optimize uma página própria para medir a velocidade real da conexão, com a mesma experiência visual de um speedtest: botão **Iniciar** central, agulha varrendo o medidor enquanto os números sobem, e resultado final travado na tela.

## Objetivos

- Medir de verdade: download, upload, ping (latência) e jitter.
- Mostrar progresso em tempo real com animação contínua da agulha e dos números.
- Exibir ping e jitter junto com os resultados finais.
- Tratar falha de conexão com mensagem de erro e ação de tentar de novo.
- Integrar a página ao menu, às rotas protegidas e ao bloqueio de páginas como qualquer outra página do app.

## Não objetivos

- Salvar histórico de medições nem comparar com testes anteriores.
- Usar os servidores ou a marca da Ookla/Speedtest.net.
- Medir perda de pacotes (fora do escopo aprovado).
- Reproduzir o visual da Ookla pixel a pixel; a referência é a sensação do medidor e da animação.

## Decisões de implementação (chamadas do construtor)

- **Fonte dos números:** endpoints públicos de speed test da Cloudflare (`https://speed.cloudflare.com/__down` e `__up`). São gratuitos, respondem com CORS liberado e não exigem chave.
- **Onde medir:** processo principal do Electron, exposto ao renderer por IPC. Isso evita depender de CORS no renderer e mantém a medição testável com `fetch` injetado.
- **Medição:** requisições GET com tamanhos crescentes para download, POST com payloads crescentes para upload, e uma bateria de GETs curtos para latência. Throughput em Mbps = bytes × 8 ÷ segundos ÷ 1.000.000. Ping = mediana das latências; jitter = média da diferença absoluta entre latências consecutivas.
- **Página:** `/velocidade`, rota protegida na categoria **Rede**.
- **Persistência:** nenhuma; o resultado vale apenas para a execução atual.

## Comportamento observável

1. Estado inicial: medidor zerado, botão **Iniciar** habilitado.
2. Ao clicar em Iniciar: botão vira **Cancelar**; fases latency → download → upload; a agulha e o número da fase acompanham o progresso.
3. Ao terminar: agulha para no valor final de download; cards mostram download, upload, ping e jitter; botão vira **Testar novamente**.
4. Ao cancelar: medição é abortada e a página volta ao estado inicial.
5. Em erro: mensagem clara e botão **Tentar novamente**.

## Restrições do projeto

- Seguir TDD: nenhum código de produção sem teste que falhe antes.
- Gate antes de commit: `bun run lint && bun run typecheck && bun run test`.
- Build antes de concluir: `bun run build`.
- Biome para lint/format; Vitest para testes; bun como package manager.
- Não commitar `.env.local`.
