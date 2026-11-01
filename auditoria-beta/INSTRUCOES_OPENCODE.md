# Instruções para o OpenCode — FM Optimization

Você está no terminal integrado, na raiz do repositório local `FM_Optimization`.

Leia, nesta ordem:

1. `AGENTS.md` — convenções obrigatórias do projeto.
2. `docs/ARCHITECTURE.md` e `docs/SECURITY.md` — arquitetura e fronteiras de segurança.
3. `auditoria-beta/AUDITORIA_SCRIPTS.md` — evidências da auditoria estática.
4. `auditoria-beta/PLANO_IMPLEMENTACAO_BETA.md` — fases e critérios de aceitação.

Se os arquivos estiverem em outra pasta, localize-os antes de iniciar. A auditoria é um ponto de partida: confira cada conclusão contra o código local antes de implementar. Não presuma que scripts preservados são seguros só porque não são duplicados.

Comece com `git status` e verifique se a branch `beta` existe. Preserve alterações locais e não modifique `main`. Planeje a execução por etapas, com testes de regressão. Não execute scripts que alterem o Windows real. Ao concluir, rode `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build`; informe os resultados sem omitir falhas. Faça commits somente em `beta` e abra PR em rascunho para `main` se houver acesso ao GitHub, **sem merge**.

Antes de editar, apresente um resumo curto das alterações planejadas e dos riscos identificados. Após implementar, apresente um relatório de arquivos alterados, scripts removidos/consolidados, compatibilidade, testes e pendências.
