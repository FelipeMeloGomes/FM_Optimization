# Projeto

FM-Optimize — toolkit de otimização Windows.

- **Stack:** Electron + TypeScript, React 19, Tailwind CSS 4, electron-vite
- **Linter/Formatter:** Biome (`npm run lint`, `npm run lint:fix`, `npm run format`)
- **Testes:** Vitest (`npm run test`)
- **Package manager:** npm
- **Dados do usuário:** `%APPDATA%\fm-optimize\`
- **`.env.local` na raiz contém `GITHUB_TOKEN` — NUNCA commitar (já está no `.gitignore`)**
  - Token fine-grained (`github_pat_...`) ou classic PAT (`ghp_...`) — ambos funcionam via `Authorization: Bearer`

# Build

| Comando | O que gera |
|---|---|
| `npm run dev` | Dev server com hot reload |
| `npm run build` | Compila TS → `out/` |
| `npx electron-builder --win` | Todos os targets + `latest.yml` |
| `npx electron-builder --win portable` | Só o portable (`dist/fm-optimize-portable.exe`) |
| `npx electron-builder --win nsis` | Só o instalável (`dist/fm-optimize-setup.exe` + `.blockmap`) |

# Quality

Antes de qualquer commit, rodar na raiz do repo:

```powershell
npm run lint && npm run typecheck && npm run test
```

Se houver erros, corrigir antes de commitar.

A suíte do Vitest cobre `electron/main/**/*.test.ts` **e** `src/**/*.test.ts` (main process + renderer). Vale ler o que foi realmente coberto: um teste com catálogo transcrito à mão prova a aritmética, não a fiação com o `scripts.json` real.

# Commit

- Verificar se `README.md` foi atualizado com as últimas mudanças.
- Trabalhar sempre a partir da raiz do repositório.

# Release (GitHub)

## Regras rígidas

- NUNCA rode `electron-builder` antes de `npm version`
- NUNCA faça commit sem antes rodar `npm run typecheck`
- NUNCA crie release com working tree sujo
- NUNCA esqueça de verificar que `dist/latest.yml` contém a versão correta após o build
- NUNCA commite `.env.local`

## Rollback

Se o script falhar após `npm version` (bump + commit + tag local) mas antes do push:

```powershell
git tag -d vX.Y.Z
git reset --hard HEAD~1
```

Substituir `vX.Y.Z` pela tag que foi criada. Depois corrigir o problema e tentar novamente.

## Corpo da release

O body deve conter apenas mudanças relevantes para o usuário final, em português.
Agrupar em seções: **Novidades**, **Melhorias**, **Correções**.
Commits técnicos (chore, bump, docs, refactor) ficam em uma seção "Técnico" no final ou são omitidos.

Template:

```markdown
## vX.Y.Z - dd/MM/yyyy

### Novidades
-

### Melhorias
-

### Correções
-
```

## Ordem das operações

1. `npm version <tipo>` — bump no `package.json`, commit + tag local
2. `npm run build` — compila TypeScript
3. `npx electron-builder --win` — gera builds + `latest.yml`
4. Verificar que `dist/latest.yml` contém a versão correta
5. Perguntar/preencher corpo da release
6. `git push --follow-tags`
7. Criar release no GitHub + upload dos assets

**Por que a ordem importa:** o `electron-builder` grava a versão do `package.json` no `latest.yml`. Se o build rodar antes do `npm version`, o `latest.yml` terá a versão antiga e o `electron-updater` não oferecerá a atualização.

## Pré-requisitos

- [ ] `.env.local` na raiz com `GITHUB_TOKEN` (fine-grained `github_pat_...` ou classic `ghp_...`)
- [ ] `README.md` revisado e atualizado (se houver mudanças visuais/funcionais)
- [ ] Working directory é a raiz do repositório
- [ ] Working tree limpo (sem arquivos não commitados)

## Script

```powershell
.\scripts\release.ps1
```

O script faz tudo: pede o bump, builda, valida assets, pergunta o corpo da release, faz push e cria a release no GitHub.
