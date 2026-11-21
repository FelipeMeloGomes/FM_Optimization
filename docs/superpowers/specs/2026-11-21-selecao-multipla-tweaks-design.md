# Seleção múltipla de tweaks — desenho

Data: 2026-11-21

## Intenção

Trocar o botão **Executar** individual dos cards de tweak nas páginas de otimização pela mecânica já usada em **Limpeza**: uma barra com **Selecionar todos**, contador de selecionados e um botão único que aplica tudo que foi marcado. A pessoa passa a marcar vários cards e aplicar de uma vez, em vez de abrir uma confirmação por tweak.

Páginas incluídas (7):

| Rótulo                | Arquivo                             |
| --------------------- | ----------------------------------- |
| Input Lag             | `src/pages/InputLagPage.tsx`        |
| Otimização do sistema | `src/pages/CpuPage.tsx`             |
| Personalização        | `src/pages/PersonalizationPage.tsx` |
| Internet              | `src/pages/NetworkPage.tsx`         |
| Armazenamento         | `src/pages/StoragePage.tsx`         |
| Privacidade           | `src/pages/PrivacySecurityPage.tsx` |
| Reparo do Sistema     | `src/pages/SystemRepairPage.tsx`    |

**Não incluídas:** Limpeza e Debloat (já têm o padrão), DNS, Ferramentas/Utilitários, Dispositivo, Overlay, Histórico.

## Por que

Hoje cada tweak exige um clique em **Executar**, uma confirmação e o retorno ao card para o próximo. Em páginas com 12 tweaks (Internet) ou 8 (Personalização), isso é repetitivo. O usuário pediu explicitamente o comportamento de Limpeza: marcar os cards da listagem e aplicar em lote.

## Decisões fechadas com o usuário

- **Estado inicial da seleção: nenhum tweak marcado.** Não replicar o comportamento de Limpeza, que já abre com tudo selecionado. O botão **Selecionar todos** fica disponível para marcar em massa.
- **Referência de funcionamento: página Limpeza** — barra de seleção, checkbox por linha/card, contador, botão de aplicar em lote e confirmação com a lista do que será aplicado.
- **Escopo: as 7 páginas listadas acima**, não todas as páginas do app.

## Objetivos

- Marcar tweaks individualmente por checkbox nos cards das 7 páginas.
- **Selecionar todos** marcando/desmarcando todos os tweaks efetivamente visíveis na página (respeitando filtros locais, como `hasSSD()` em Armazenamento).
- Aplicar todos os selecionados com um único botão e uma única confirmação, respeitando `settings.confirmOnExecute`.
- Executar os scripts **sequencialmente** — um termina antes do próximo começar — com indicação de progresso ("2 de 5").
- Manter o cancelamento do script em execução.
- Manter o padrão de rolagem da página adotado no commit `93c4453` (sem scroll interno novo).

## Não objetivos

- Não alterar catálogo de scripts, conteúdo dos `.ps1`/`.bat` nem IPC — a bridge continua expondo `executeScript(id)` individual.
- Não adicionar "Selecionar recomendados": não existe metadado de recomendação para tweaks, ao contrário dos itens de limpeza.
- Não mudar Limpeza, Debloat, DNS, Utilitários, Dispositivo nem qualquer rota fora das 7.
- Não criar resolução automática de conflitos entre scripts (pares aplicar/reverter, pacotes amplos). A confirmação lista tudo o que será executado e a decisão é da pessoa.
- Não mudar a ordem em que os scripts aparecem em cada página.

## Ant objetivos (falha mesmo funcionando)

- Disparar dois tweaks ao mesmo tempo: o contexto hoje rastreia um único `activeExecution`, e vários scripts de registro/consumo concorrentes corromperiam esse estado.
- Aplicar um tweak que a pessoa não viu na confirmação.
- Deixar o botão de lote habilitado com zero selecionados.
- Selecionar por padrão — a pessoa decidiu que a página abre sem nada marcado.
- Criar scroll interno novo nas listagens, desfazendo o padrão de rolagem da página.

## Restrições

- Windows, Electron + React 19 + TypeScript, Tailwind 4.
- `ScriptExecutionContext` guarda **um** `activeExecution: string | null`; `execute(id)` sobrescreve `activeRef.current`. Lote precisa de executor sequencial novo, não de `Promise.all`.
- **Atenção:** `executeScript(id)` no main só faz `spawn` e devolve `'started'`/`'opened'` imediatamente; o término real chega depois pelo evento `script-ended`. Logo, `await execute(id)` **não espera o script acabar** e um `for...of` ingênuo dispararia tudo ao mesmo tempo.
- `ConfirmDialog` é amarrado a um único `ScriptEntry`; confirmação em lote precisa de componente próprio, no espírito de `ConfirmCleanDialog`.
- 6 páginas renderizam tweaks por `VirtualizedSectionCard`; somente Input Lag tem grade própria.
- Existem scripts problemáticos em lote, que devem continuar visíveis e selecionáveis, mas nunca executados em paralelo:
  - Input Lag: `inputlag-4` ("Usar TODAS OPÇÕES Input Lag") sobrepõe os outros 5.
  - Otimização do sistema: `tweaks-3` ("Otimizar Hardware") e `tweaks-4` ("Modo Gamer") aplicam pacotes amplos.
  - CPU: `builtin-4↔builtin-6`, `builtin-5↔builtin-7`, escada RAM `cpu-30..cpu-37`.
  - Personalização: `apps-4↔apps-5`, `apps-6↔apps-7` (ambos interativos).
  - Internet: `internet-11` (reverter), `dns-2` (reset com reinício).
  - Armazenamento: `util-4` e `builtin-88` (TRIM/otimização de SSD).
  - Privacidade: `apps-1` (pacote amplo) e `apps-2` (interativo).
  - Reparo: `builtin-87`, `builtin-40`, `builtin-64` (scans longos).
- Todo código novo precisa de teste cobrindo comportamento real; correção de bug, teste de regressão vermelho-verde.
- Gate antes de commit: `bun run lint && bun run typecheck && bun run test`.
- Interface e documentação em português. Nada de commit, push ou release sem pedido explícito.

## Decisões de implementação (minhas, não do usuário)

### Estado e componentes compartilhados

- Novo hook `src/hooks/use-script-selection.ts`: guarda `Set<string>` de ids selecionados, expõe `toggle`, `selectAll(ids)`, `clear()` e `isSelected(id)`. Estado começa vazio.
- Novo componente `src/components/ScriptSelectionToolbar.tsx`: barra no estilo de `CleanerPage` com botão **Selecionar todos** (vira **Limpar seleção** quando tudo está marcado), contador `N de M selecionados`, botão **Aplicar selecionados** (desabilitado com zero selecionados ou lote em andamento) e progresso `N de M` durante a execução. O botão substitui os cards de pacote amplo removidos das páginas. Quando o lote termina com falhas, a barra mostra um `role="alert"` com os nomes não concluídos.
- Novo componente `src/components/ConfirmBulkScriptDialog.tsx`: lista os nomes dos scripts selecionados e o total, com **Cancelar** e **Aplicar**. Análogo a `ConfirmCleanDialog`, sem timer por script.
- `useScriptPage` continua cuidando do caminho individual? **Não.** As 7 páginas passam a ter um único caminho de aplicação: marcar e aplicar em lote. Botões **Executar** individuais são removidos dos cards. Para executar um único tweak, a pessoa marca só ele. Isso espelha Limpeza.

### Execução em lote

- `ScriptExecutionContext` ganha `executeBatch(scripts: ScriptEntry[]): Promise<{ failedIds: string[] }>` — recebe os scripts para saber qual é interativo. `useScriptPage` mantém a API individual (usada por páginas fora do escopo) e ganha a API de lote: `handleApply(scripts)`, `confirmBulkScripts`, `setConfirmBulkScripts`, `handleConfirmBulk`, `batch`, `failedScripts`, `clearFailures()`.
- **Decisão minha: não alterar a bridge/IPC.** O main já emite `script-ended` com o id e o desfecho; o renderer já assina esse evento. Cada passo do lote será `await new Promise` que resolve quando chegar o `script-ended` do id correspondente — registrado **antes** de chamar `execute(id)`, para não perder o evento. Assim a bridge continua `executeScript(id)` simples.
  - Proteção contra travamento: timeout de **30 minutos por passo** para scripts não interativos; ao estourar, registrar falha e seguir. Scripts com `interactive: true` não têm timeout — a pessoa fecha a janela do CMD quando termina.
  - Estado `batch: { ids: string[]; index: number } | null` para a barra mostrar progresso ("2 de 5").
  - `activeExecution` continua existindo e passa a refletir o script atual do lote.
  - Se um script falhar, o loop **continua** com os demais e ao final a página mostra aviso com a lista de falhas. Não há abort silencioso.
  - `cancel(id)` continua cancelando o script atual; o `script-ended` seguinte libera o passo.
  - Scripts interativos (`apps-2`, `apps-4` etc.) abrem janela do CMD e só terminam quando a pessoa fecha — o lote espera, o que é o comportamento correto e precisa estar visível na confirmação.
- `settings.confirmOnExecute` continua sendo respeitado: se desligado, `executeBatch` roda direto; se ligado, abre `ConfirmBulkScriptDialog` primeiro.

### Integração nas páginas

- Input Lag: grade própria recebe checkbox por card; `REGISTRY_SCRIPTS` continua a fonte dos ids.
- As outras 6: `VirtualizedSectionCard` recebe `selectedIds`, `onToggle` e `disabled`, troca o botão **Executar** por checkbox por linha e mantém **Cancelar** no script em execução. Seções continuam filtrando por `scriptIds` e mantêm `data-index` no elemento medido. O componente só é usado por páginas deste escopo, então a troca de API é total.
- A barra de seleção fica acima da lista/seções, abaixo do hero e dos avisos.
- A seleção é **por página** (cada instância do hook). Trocar de rota descarta a seleção — sem persistência.
- `Aplicar selecionados` usa os scripts resolvidos no momento do clique (já filtrados), não uma lista congelada do catálogo inteiro.

### Scripts que já aplicam "todas as opções"

Decisão do usuário: nas páginas que têm um script que aplica todas as opções, **esse card troca pelo botão "Selecionar todos"**. Ou seja, o card do pacote amplo sai da listagem e o botão da barra passa a fazer o papel que ele fazia — marcar todos os tweaks individuais e aplicá-los em lote. O script continua no catálogo; só deixa de ser exibido como card nessas páginas.

Candidatos identificados no catálogo (`resources/scripts.json`):

| Página                | Script       | Nome no catálogo            | Observação                                                            |
| --------------------- | ------------ | --------------------------- | --------------------------------------------------------------------- |
| Input Lag             | `inputlag-4` | Usar TODAS OPÇÕES Input Lag | Caso explícito — o próprio nome pede a troca                          |
| Otimização do sistema | `tweaks-3`   | Otimizar Hardware           | "Todas as otimizações de hardware em um único script"                 |
| Otimização do sistema | `tweaks-4`   | Modo Gamer                  | Aplica várias otimizações de uma vez ("todas as otimizações ligadas") |

**Decisão do usuário:** saem da listagem apenas `inputlag-4`, `tweaks-3` e `tweaks-4`. `internet-11` ("Reverter Internet") e `apps-1` ("Privacidade Máxima") **continuam como cards normais** — o primeiro reverte, não aplica, e o segundo não se chama "todas as opções".

Regra de implementação: remover o id do pacote da lista de ids selecionáveis da página (em Input Lag, tirar `r1` de `REGISTRY_SCRIPTS`; nas demais, filtrar o id vindo das seções). O botão **Selecionar todos** passa a marcar exatamente os tweaks individuais que sobraram.

## Partes a implementar

1. `src/hooks/use-script-selection.ts` + teste.
2. `src/components/ScriptSelectionToolbar.tsx` + teste.
3. `src/components/ConfirmBulkScriptDialog.tsx` + teste.
4. `src/contexts/ScriptExecutionContext.tsx`: `executeBatch`, progresso e tratamento de falhas + teste.
5. `src/components/VirtualizedSectionCard.tsx`: props de seleção + teste.
6. Refatoração das 7 páginas + ajuste dos testes existentes.
7. Atualizar `README.md` com o novo comportamento.
8. Gate: lint, typecheck, teste.

## Adendo: layout idêntico ao da Limpeza (decisão do usuário, 21/11)

Revisão do app em dev: o usuário rejeitou o visual entregue por não seguir o layout das páginas de referência. A referência é `src/pages/CleanerPage.tsx`. Escopo escolhido: **visual completo da Limpeza**.

- As 7 páginas passam a renderizar os tweaks em **uma única lista virtualizada**, com `divide-y`, sem cards com borda e sem agrupamento por seção.
- A barra usa o padrão da Limpeza: `<label>` com checkbox `size-4 accent-primary` e o contador dentro dele. Mantém **Limpar seleção** como ação secundária ao lado do checkbox (substitui a vaga de "Selecionar recomendados" da Limpeza), preservando o requisito original de texto.
- Linhas seguem o padrão da Limpeza: `px-4 py-3`, checkbox com `id`/`<label htmlFor>`, `size-4 shrink-0 accent-primary`.
- Botão de aplicar ganha ícone e estado "Aplicando…" durante o lote, espelhando "Limpando…".
- Input Lag, que tinha grade própria, também passa à lista única, preservando os nomes/descrições curados do registry.
- A ordem de exibição permanece a mesma: para as 6 páginas com seções, a lista é achatada na ordem das seções; em Input Lag, na ordem do registry.

## Fora do desenho

- Push, release, build de instalador.
- Mudanças no main process, no catálogo de scripts ou em páginas não listadas.
