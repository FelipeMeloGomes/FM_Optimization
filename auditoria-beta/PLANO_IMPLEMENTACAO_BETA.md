# Plano de implementação — branch beta

## Objetivo

Aplicar a auditoria em `AUDITORIA_SCRIPTS.md` ao código real do FM Optimization, preservando funcionalidades úteis, histórico, segurança e compatibilidade. Este documento é um plano, não uma autorização para executar comandos de otimização no Windows.

## Preparação

1. Ler `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` e `docs/AUDITORIA_SCRIPTS.md`.
2. Executar `git status` e conferir a branch ativa. Preservar mudanças locais não commitadas.
3. Criar `beta` a partir de `main` somente se ainda não existir; se existir, inspecionar diferenças antes de trabalhar.
4. Confirmar que o catálogo local corresponde ao auditado (104 entradas) ou atualizar a auditoria antes de modificar.
5. Nunca modificar `main`, fazer merge, criar release ou executar scripts que alterem o Windows durante testes.

## Fase 1 — Correções de maior risco

- Revisar `electron/main/deny-list.ts`, `electron/main/services/script-registry.ts`, `electron/main/services/script-executor.ts` e os testes relacionados. Hoje a detecção de padrões de risco não equivale necessariamente a bloqueio. Definir política clara para scripts internos e conteúdo não confiável, com validação no main process.
- Corrigir relatório de sucesso prematuro para scripts interativos; distinguir janela aberta, execução concluída, cancelamento e falha.
- Revisar criação assíncrona de ponto de restauração e garantir que o resultado seja conhecido antes da execução que dependa dele.
- Revisar `apps-2`, `inputlag-4`, `inputlag-12`, `cpu-1`, `cpu-2` e scripts que alteram UAC, Defender, Windows Update, BCD ou serviços críticos. Não substituir por outros comandos perigosos.

## Fase 2 — Deduplicação conservadora

Candidatos com equivalência identificada na auditoria:

| Remover após validação | Manter provisoriamente | Atenção                                                    |
| ---------------------- | ---------------------- | ---------------------------------------------------------- |
| `cpu-24`, `cpu-29`     | `cpu-21`               | Ajuste mantido não foi certificado como benéfico ou seguro |
| `cpu-12`               | `cpu-11`               | Revisar risco de desativar serviços                        |
| `cpu-14`               | `builtin-71`           | Verificar todas as referências de DNS                      |

Atualizar `resources/scripts.json`, `electron/main/legacy-script-ids.ts`, `src/lib/applied-scripts.ts` e os testes. Não renumerar IDs. Adaptar os aliases `amd-*` e `intel-*`, preservar referências de históricos e avaliar aliases para os IDs `cpu-*` aposentados. **Não presumir que toda remoção tem um equivalente seguro.**

## Fase 3 — Sobreposições funcionais

- Limpeza: rever `cleaner-1` a `cleaner-4` e a seleção padrão do agendador. `cleaner-4` sobrepõe parte dos demais, mas `cleaner-2` e `cleaner-3` têm operações exclusivas. Compor operações sem duplicar trabalho nem perder cobertura.
- RAM: rever `cpu-30` a `cpu-37`, `src/lib/ram-script.ts`, `src/pages/CpuPage.tsx` e `src/components/CommandPalette.tsx`. A alteração de `SvcHostSplitThresholdInKB` não deve ser anunciada como liberação garantida de RAM. Validar tecnicamente antes de manter ou substituir.
- DNS/rede: comparar `internet-6`, `internet-8`, `internet-9`, `dns-1`, `dns-2` com a funcionalidade nativa de `src/pages/NetworkPage.tsx`. Não confundir configuração DNS com reset de rede.
- Registro: revisar conflitos entre `cpu-16`/`cpu-18`, `cpu-19`/`cpu-23`, `internet-1`/`internet-5` e `internet-4`/`internet-11`. Não fundir valores contraditórios nem prometer rollback sem capturar estado anterior.

## Fase 4 — Validação e entrega

- Atualizar testes que atualmente assumem 104 scripts, 37 scripts de CPU e contagens fixas de ajustes; manter verificações reais de catálogo e referências.
- Testar unicidade de IDs, Base64 válido, aliases, histórico, configurações persistidas, seleção de RAM, composição de limpeza, falhas do executor e política de risco.
- Rodar `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` na raiz do repositório.
- Testes de efeitos no Windows somente em VM isolada com snapshot e autorização explícita.
- Revisar o diff, documentar mudanças e limitações, fazer commits na `beta` e abrir PR **Draft** `beta -> main`, sem merge, caso haja acesso de escrita ao GitHub.

## Critérios de aceitação

- [ ] `main` preservada e mudanças restritas à `beta`.
- [ ] Nenhuma referência ativa a ID inexistente.
- [ ] Histórico e configurações antigas continuam legíveis.
- [ ] Scripts removidos têm justificativa e equivalência verificada quando aplicável.
- [ ] Nenhuma operação perigosa é apresentada como otimização segura sem análise.
- [ ] Scripts interativos não registram sucesso antes de comprovar conclusão.
- [ ] Fluxo de restauração não apresenta garantia falsa.
- [ ] Limpeza automática não repete operações sem necessidade nem perde funções exclusivas.
- [ ] Testes e build executados, com resultados documentados; falhas não ocultadas.
- [ ] PR criado como rascunho e **não mesclado**.

## Relatório exigido do OpenCode

Listar arquivos alterados, IDs removidos/redirecionados, decisões de segurança, testes executados e seus resultados, pendências de validação em Windows, commit(s) e link do PR, se criado.
