# AUDITORIA DE SCRIPTS — FM Optimization (base para refatoração na branch beta)

## Fonte e metodologia

Arquivo analisado: `scripts.json` enviado na conversa, correspondente ao catálogo `resources/scripts.json` na `main` conferida durante a revisão do repositório.
Total: **104 registros**, 8 categorias, IDs únicos. Todo o campo `content` foi decodificado de Base64 antes da comparação. Comparação exata foi feita normalizando CRLF/LF e espaços de fim do conteúdo; a análise funcional comparou comandos e alterações de Registro, sem executar scripts no Windows.

**Proposta conservadora de deduplicação:** excluir quatro registros confirmados, passando de **104 para 100 registros**. Nenhuma remoção deve ser aplicada antes de revisar as referências na aplicação e os testes. O JSON previamente preparado é apenas uma referência técnica; não é a versão final pronta para produção.

## A. Duplicações confirmadas — remoções propostas para o código

| Remover  | Manter       | Justificativa                                                         |
| -------- | ------------ | --------------------------------------------------------------------- |
| `cpu-24` | `cpu-21`     | Conteúdo normalizado idêntico                                         |
| `cpu-29` | `cpu-21`     | Conteúdo normalizado idêntico                                         |
| `cpu-12` | `cpu-11`     | Mesmos comandos operacionais na mesma ordem; títulos/cores diferentes |
| `cpu-14` | `builtin-71` | Ambos executam apenas `ipconfig /flushdns` (fora apresentação)        |

**Atenção:** preservar `cpu-11` ou `cpu-21` nesta etapa não significa validar tecnicamente seus ajustes. Apenas garante não perder os comandos presentes no arquivo original em razão de deduplicação.

## B. Duplicações e sobreposições adicionais (não removidas automaticamente)

### Limpeza

- `cpu-3` ↔ `cpu-5` ↔ `cpu-8` ↔ `cpu-9`: mesmo núcleo de limpeza de TEMP, prefetch, pastas históricas e logs de eventos, com pequenas diferenças. `cpu-5` tem blocos repetidos; `cpu-9` acrescenta operações de logs do BlueStacks; `cpu-8` omite a remoção de prefetch.
- `cpu-4`: mistura limpeza de eventos e arquivos de perfis; sobrepõe-se a rotinas anteriores e ao `cleaner-3`.
- `cpu-2`: menu de “Super Limpeza” que sobrepõe as outras rotinas, mas inclui exclusões mais amplas/potencialmente perigosas; não deve ser copiado integralmente.
- `cpu-7`: remoção genérica de arquivos `.log`, já presente na rotina `cleaner-1`. Priorizar logs e caminhos específicos — não apagar todos indiscriminadamente.
- `cleaner-1` ↔ `cleaner-4`: `cleaner-4` inclui todas as operações centrais de `cleaner-1` e etapas adicionais (navegadores, Windows Update, cleanmgr e DISM). Preservar modalidade rápida e completa se houver utilidade de UX; reusar funções internas.
- `cleaner-3` ↔ `cpu-6`: ambas limpam caches dos navegadores; `cpu-6` procura múltiplos usuários e caminhos legados. Unificar com checagem de perfis e confirmação.
- `cleaner-2` ↔ `cleaner-4`: cache Windows Update em comum; `cleaner-2` também faz Windows Store e shaders.
- `util-2` ↔ `cleaner-4`: ambos limpam componentes via DISM, mas `util-2` usa `/ResetBase` (ação diferente e irreversível quanto à desinstalação das atualizações substituídas).
- `util-6` e `cleaner-4`: ambos invocam `cleanmgr`, mas `util-6` abre a interface e `cleaner-4` roda `/sagerun:1` configurado à parte.

### Rede e DNS

- `internet-6` ↔ `dns-1`: configuram DNS; `internet-6` fixa Google em Wi-Fi e Ethernet; `dns-1` escolhe servidor em uma interface detectada. Unificar após corrigir a detecção da interface.
- `internet-9` ↔ `dns-2`: renovação IP, limpeza DNS e reset Winsock; `dns-2` também reseta TCP/IP, firewall e ARP (mais invasivo). Não confundir os dois níveis.
- `internet-1`, `builtin-18`, `cpu-10`: conjuntos concorrentes de `netsh tcp`; sobreposição e valores contraditórios. Consolidar após revisão de suporte Windows.
- `internet-5` desabilita autotuning, enquanto `internet-1`, `builtin-18`, `cpu-10` ativam/normalizam. São conflitantes, não clones.
- `builtin-71` é execução direta de flush DNS; `dns-3` também faz flush no meio de um diagnóstico; `dns-1` ao concluir a alteração.
- `internet-4`: diversas gravações repetidas nas mesmas chaves AFD (inclusive valores incompatíveis); exige reconstrução ou retirada.
- `internet-8`: diversas gravações repetidas nas mesmas chaves DNS/Dnscache com valores distintos; exige reconstrução ou retirada.
- `internet-11`: tentativa de reversão com entradas `ADF` em vez de `AFD` em parte do arquivo, então não restaura integralmente `internet-4`. **Não confiar como rollback geral.**

### Jogos / entrada / energia

- `cpu-16` ↔ `cpu-18`: quase o mesmo REG, mas divergem em `Priority` (`6` vs `2`) e `GameDVR_Enabled` (`0` vs `1`). **Conflito; não fundir cegamente.**
- `cpu-19` ↔ `cpu-23`: mesma chave `SystemResponsiveness`, valores diferentes (`0x14` vs `0x1`); `builtin-15` usa `0`. **Conflito.**
- `inputlag-4` é pacote de várias alterações já presentes em `inputlag-5` a `inputlag-12` e/ou scripts de teclado/mouse. Contém modificações de Windows Update e `EnableLUA` alheias a input lag; candidato a **remover após auditoria**.
- `inputlag-9` (`KeyboardDelay=0`) ⊂ `inputlag-1`.
- `inputlag-11` (`MouseSpeed`, `MouseThreshold1/2`) ⊂ `inputlag-2`.
- `inputlag-10` (`MenuShowDelay=0`) ⊂ `builtin-32`.
- `inputlag-5` usa a mesma configuração de suspensão seletiva USB que `tweaks-3`.
- `inputlag-7`, `builtin-15`, `tweaks-4` e `cpu-28` alteram `Win32PrioritySeparation` com valores diferentes (26 e 38 decimal). **Conflito.**
- `cpu-30` a `cpu-36` variam apenas o valor de `SvcHostSplitThresholdInKB`, anunciado como “liberar RAM” conforme capacidade instalada. Unificar no máximo em uma ferramenta contextual — idealmente remover o grupo sem evidência/benchmark de ganho. `cpu-37` não garante restauração do padrão original (fixa um único valor).
- `util-4` ↔ `builtin-88`: defrag `/O` e `/L` em ambos, diferindo no modo de execução e tarefas adicionais. Unificar com checagem de tipo de unidade.
- `tweaks-2` ↔ `builtin-32`: mesmo objetivo visual, mas chaves/ajustes distintos; podem ser reunidos em uma interface de ajustes granulares.
- `tweaks-6` ↔ `cpu-11`: desativação de serviços com sobreposição parcial; `cpu-11` desabilita serviços adicionais importantes, portanto não são equivalentes.
- `tweaks-4` ↔ `cpu-16`/`builtin-15`: GameDVR e prioridade de jogos, mas cada um tem outras ações — melhorar arquitetura modular em vez de apenas excluir.
- `cpu-1`, `cpu-15`, `tweaks-4`: manipulam opções BCD/temporizador potencialmente conflitantes; não aplicar automaticamente.

### Scripts a manter distintos

- `apps-4`/`apps-5`: aplicar/reverter modificação do Discord; não duplicação.
- `apps-6`/`apps-7`: aplicar/reverter modificação do Spotify; não duplicação.
- `builtin-4`/`builtin-6`, `builtin-5`/`builtin-7`: aplicar/reverter ajustes de drivers; não duplicação.
- `tweaks-5`: interface de planos de energia, distinta da aplicação dos tweaks de `tweaks-3`.
- `dns-4`: benchmark de conectividade dos servidores, distinto da seleção em `dns-1` (observação: ping não mede diretamente tempo de resolução DNS).
- `builtin-13`: abrangente, configurável e parcialmente sobreposto a vários scripts, mas com fluxo próprio; exige revisão individual, não excluir por tamanho.

## C. Problemas de segurança, nomes e confiabilidade

1. `apps-2` (chamado “Segurança do Windows”) oferece **desabilitar o Microsoft Defender e o Windows Update**. Não disponibilizar isso como melhoria de segurança; idealmente retirar essas opções.
2. `inputlag-12` (chamado “Aumentar Taxa de Atualização”) altera `EnableLUA` em chave de políticas do usuário, **não a taxa de atualização do monitor**. O pacote `inputlag-4` contém a mesma alteração; remover/corrigir.
3. `cpu-17` (“Ativar Núcleos”) altera um atributo de configuração de energia, **não ativa núcleos do processador**. Corrigir descrição e não prometer efeito.
4. `builtin-22` usa `rundll32 advapi32.dll,ProcessIdleTasks`; **não é uma rotina garantida de liberação de RAM**.
5. `cpu-2` apaga logs e diversos arquivos amplamente, inclusive caminhos do sistema. Afirmar “limpeza segura” sem validação é inadequado.
6. `cpu-3`, `cpu-8`, `cpu-9` têm linha inicial `/s /f /q ...` sem o comando `del`, além de `deltree` (legado) e limpeza de Event Logs. `cpu-4`/`cpu-5` contêm estruturas antigas/inconsistentes.
7. `cleaner-1` e `cleaner-4` apagam genericamente `C:\*.log`, prefetch e lixeira. Isso pode prejudicar diagnóstico e experiência; tornar operações opt-in e revisar caminhos/erros.
8. `util-2` usa DISM `/ResetBase`, que impossibilita a desinstalação das atualizações substituídas; confirmar separadamente.
9. `cpu-1` desabilita o carregamento do hypervisor (`hypervisorlaunchtype off`), podendo quebrar WSL2/Hyper-V e cenários que dependem de virtualização.
10. `cpu-13` altera cache, pagefile, prefetch e outras chaves de baixo nível. Não equivale a uma liberação segura de RAM.
11. `internet-4`/`internet-8` regravam muitas vezes a mesma chave; `internet-11` contém chaves `ADF` incorretas.
12. `cpu-28` contém uma linha de texto puro fora da sintaxe válida de `.reg` e mistura alterações de rede/Mouse/boot sob o nome “Priorizar FPS”.
13. Vários scripts exibem `[OK]` mesmo com `>nul 2>&1`, sem verificar códigos de saída: não há prova de sucesso.
14. `cpu-30` a `cpu-36` não “liberam RAM” diretamente; alteram separação de processos de serviços do Windows. Não oferecer como booster sem evidência.
15. A classificação `riskLevel` deve considerar alteração de segurança, reversibilidade, privilégios, backup, compatibilidade e efeitos em configurações do usuário.

## D. Plano recomendado de refatoração

1. Preservar o JSON original como backup e verificar referências a IDs no código da aplicação antes da integração.
2. Integrar o JSON conservador (4 remoções). **Este é o único conjunto removido automaticamente.**
3. Migrar limpeza para operações pequenas e reutilizáveis (TEMP, cache navegadores, Windows Update, componentes), com opções rápida/completa que compõem essas operações sem duplicação de código.
4. Migrar mudanças de Registro para entradas tipadas e validadas (`hive`, `path`, `name`, `type`, `value`), com detecção de conflitos e cópia do valor anterior.
5. Tratar DNS e ajustes TCP como perfis mutuamente exclusivos, com captura e restauração do estado anterior por interface.
6. Eliminar opções de segurança indevidas e substituir scripts de “boost” sem mecanismo comprovado por recursos descritivos ou diagnósticos.
7. Adicionar testes automáticos para: ID único, conteúdo Base64 válido, assinaturas duplicadas, chaves conflitantes, comandos de risco e metadados (`requiresAdmin`, `requiresRestart`, `riskLevel`).
8. Testar alterações e reversões numa VM Windows apropriada antes de liberar no aplicativo.

## E. Verificações adicionais realizadas no repositório

Revisão de arquivos da branch `main`, commit-base observado `f274bb77159397bc031573d92d7cf747534daef2` (verificar se a `main` avançou antes de executar o plano):

| Arquivo                                                                               | Evidência encontrada                                                                                                                | Consequência para a refatoração                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `electron/main/services/script-registry.ts`                                           | Catálogo lido de `resources/scripts.json`, cache com `mtime` no desenvolvimento, resolução de IDs legados e verificação de conteúdo | Remover registro exige atualização de aliases, históricos, testes e referências. Não quebrar recarga dev.        |
| `electron/main/legacy-script-ids.ts`                                                  | 74 aliases `amd-N`/`intel-N` para `cpu-N`                                                                                           | `cpu-12`, `cpu-24`, `cpu-29` são destinos de aliases; migrar destinos para equivalentes, se comprovados.         |
| `electron/main/tests/legacy-script-ids.test.ts`                                       | Testa 74 aliases, 37 destinos, dois aliases por CPU e que todos os destinos existam                                                 | Atualizar invariantes para representar a realidade pós-consolidação, sem reduzir cobertura.                      |
| `electron/main/tests/script-catalog.test.ts`                                          | Espera 104 scripts, 37 CPUs, sequência `cpu-1..37`, e reconhece duplicata `cpu-21`/`cpu-24`                                         | Testes precisam verificar IDs reais, detecção de duplicatas e diferenças legítimas, não sequência sem lacunas.   |
| `src/lib/applied-scripts.ts`                                                          | Exclui `cpu-12`, `cpu-31..36` e `internet-5` da contagem aplicada                                                                   | Ao remover script, também limpar exclusões e recalcular indicador corretamente.                                  |
| `src/lib/applied-scripts.catalog.test.ts`                                             | Expectativas fixas 104/82/78                                                                                                        | Ajustar expectativas após alterações e preservar regra do cálculo.                                               |
| `src/lib/ram-script.ts`, `src/pages/CpuPage.tsx`, `src/components/CommandPalette.tsx` | Os `cpu-30..36` são usados para recomendações por quantidade de RAM                                                                 | Não remover essa família sem substituir o comportamento e ajustar UI/busca/testes.                               |
| `electron/main/services/auto-clean-settings.ts`, `electron/main/validation.ts`        | Seleção padrão de limpeza contempla `cleaner-1`, `cleaner-2`, `cleaner-3`, `cleaner-4`                                              | Executa operações sobrepostas; não descartar `cleaner-2`/`cleaner-3` integralmente, pois têm trabalho exclusivo. |
| `electron/main/services/auto-clean-scheduler.ts`                                      | Executa limpadores em série e persiste configurações/pendências                                                                     | Reduzir duplicações no nível de operação; preservar agendamento e `pending`.                                     |
| `electron/main/services/cleaner-stats.ts`                                             | A categoria `cleaner-4` agrega categorias de `cleaner-1..3`                                                                         | Estatísticas agregadas podem repetir contagens se somadas ingenuamente.                                          |
| `src/pages/NetworkPage.tsx`                                                           | Interface DNS nativa e `DNS_SCRIPT_IDS` oculta `internet-6`, `internet-8`, `internet-9`                                             | Avaliar retirada de scripts redundantes sem perder diagnóstico e recuperação.                                    |
| `electron/main/deny-list.ts`                                                          | `checkScriptContent()` detecta padrões mas retorna `allowed: true` sempre                                                           | Segurança não bloqueia por essa função; decidir política com testes e revisão do catálogo.                       |
| `electron/main/services/script-executor.ts`                                           | Script interativo é registrado como sucesso na abertura; ponto de restauração é disparado sem await                                 | Corrigir estados `opened`/`completed` e verificar restauração antes de alterações quando requerida.              |
| `src/lib/app-sections.ts`                                                             | `apps-2` aparece na seção “Segurança”                                                                                               | Conteúdo que reduz proteção do Windows contradiz a categoria e precisa ser revisto.                              |

**Nota metodológica:** essas evidências foram extraídas da leitura do código e da auditoria estática dos comandos decodificados. Nenhum script foi executado nem foram feitos benchmarks de FPS, latência, memória ou estabilidade do Windows.

## F. Decisões e restrições explícitas

1. **Remoção de duplicatas é diferente de certificação do script mantido.** Ex.: `cpu-11` pode continuar sendo arriscado mesmo após retirar `cpu-12`.
2. Preferir remoção de `cpu-12`, `cpu-24`, `cpu-29`, `cpu-14` **somente após** adaptar aliases, testes e histórico. Preservar `cpu-11`, `cpu-21`, `builtin-71` como sobreviventes provisórios, não como ajustes certificados.
3. Para `inputlag-12` e `apps-2`, **não** substituir por outra alteração sensível de segurança sem justificativa e consentimento.
4. `cpu-30..36`: são valores de um único tweak de Registro, mas não há garantia de “liberação de RAM”. Decidir após revisão técnica, não manter apenas porque há UI.
5. `internet-11` não é um rollback confiável de `internet-4`; operações de reversão devem restaurar o valor capturado previamente, e não um valor genérico presumido.
6. Limpeza total: evitar trabalho repetido **sem** perder rotinas exclusivas de limpeza de navegador, Store, shaders e Windows Update.
7. Restaurar controle de risco sem bloquear o catálogo inteiro: diferenciar conteúdo interno versionado, conteúdo externo/customizado e classes de risco. Nenhuma decisão de segurança deve depender apenas do campo Base64.
8. Testes de código são obrigatórios, mas **testes reais de scripts modificadores de Windows só em VM/sandbox adequada com snapshot**.
9. Verificar `git status` antes de qualquer operação e preservar trabalho não commitado. Nunca fazer merge automático com `main`.

## G. Limitações

A auditoria é **estática**, não ensaio operacional. Arquivos e nomes correspondem à `main` observada na revisão e podem mudar; verificar o estado local antes de editar. A remoção de comandos ou a alteração de valores do Registro requer inspeção do efeito concreto em versões suportadas do Windows, testes de regressão e, quando aplicável, VM com restauração. A deduplicação estrutural não certifica segurança ou compatibilidade.
