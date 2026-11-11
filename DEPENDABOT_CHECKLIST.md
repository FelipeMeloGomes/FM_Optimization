# 🛡️ Checklist de Correção — Dependabot Security

> ✅ **Status final (11/11/2026): 0 alertas abertos · 100 corrigidos · 0 dispensados**
> Verificado direto na API do GitHub (`/repos/.../dependabot/alerts`) com o token do `.env.local`.

Este documento registra a correção dos **100 alertas de segurança** que estavam abertos no Dependabot do repositório `FelipeMeloGomes/FM_Optimization`, além de servir de guia para os próximos alertas.

> 🔄 O `.github/dependabot.yml` está configurado para verificar atualizações **todos os dias**.

---

## Resultado final

| Métrica                  | Valor                          |
| ------------------------ | ------------------------------ |
| Alertas abertos          | **0**                          |
| Alertas corrigidos       | **100**                        |
| Alertas dispensados      | 0                              |
| `npm audit`              | **0 vulnerabilidades**         |
| Gate de qualidade        | lint ✅ · typecheck ✅ · 1037 testes ✅ |
| Gerenciador de pacotes   | **bun** (`bun.lock`)           |
| Lockfiles removidos      | `package-lock.json`, `pnpm-lock.yaml` |

---

## O que foi feito

1. **Dependências diretas atualizadas** para as versões corrigidas (electron, vite, vitest, zod, systeminformation, tar, entre outras).
2. **Overrides no `package.json`** para forçar versões corrigidas em dependências transitivas:

   ```json
   "overrides": {
     "minimatch": "11.0.1",
     "brace-expansion": "5.0.12",
     "@xmldom/xmldom": "0.9.12"
   }
   ```

3. **Migração de pnpm/npm para bun** — o projeto usa `bun.lock`; `pnpm-lock.yaml` e `package-lock.json` foram removidos.
4. **Remoção do `package-lock.json`** foi o passo que fechou o último alerta (#188): o Dependabot lia esse lockfile desatualizado e continuava reportando o minimatch antigo, mesmo com o `package.json` já corrigido.
5. **PR #2 fechado** (`chore(deps-dev): bump ip-address from 10.2.0 to 10.7.6`) — alterava apenas `package-lock.json` e `pnpm-lock.yaml`, que não existem mais; a atualização já está aplicada no `package.json`.

### Commits da correção

| Commit    | Descrição                                                                    |
| --------- | ---------------------------------------------------------------------------- |
| `797a28f` | `fix(deps): migrar para bun e corrigir última vulnerabilidade do Dependabot` |
| `454dc73` | `fix(deps): remover package-lock.json (migração para bun)`                   |
| `5a8aa23` | `fix(deps): corrigir última vulnerabilidade do Dependabot (minimatch)`       |

---

## Resumo por pacote (alertas corrigidos)

| Pacote                   | Alertas | Versão que fechou os alertas | Versão final no projeto |
| ------------------------ | ------- | ---------------------------- | ----------------------- |
| electron                 | 57      | 38.8.6 → 42.11.16            | `^45.3.0`               |
| tar                      | 12      | 7.5.3 → 7.5.21               | `7.5.22`                |
| brace-expansion          | 9       | 1.1.19 → 5.0.12              | `5.0.12` (override)     |
| vite                     | 5       | 6.4.4                        | `^6.4.4`                |
| ip-address               | 4       | 10.7.1 / 10.7.4              | `^10.7.6`               |
| minimatch                | 2       | 11.0.1                       | `11.0.1` + override     |
| glob                     | 2       | 14.0.2                       | transitiva              |
| extract-zip              | 2       | — (sem versão corrigida)     | `2.0.1`                 |
| systeminformation        | 2       | 5.33.14 / 5.33.16            | `^5.33.16`              |
| zod                      | 1       | 4.6.6                        | `^4.6.6`                |
| @vitest/mocker           | 1       | 4.1.12                       | `4.1.12`                |
| source-map-js            | 1       | 1.2.2                        | `1.2.2`                 |
| builder-util-runtime     | 1       | 9.7.0                        | `9.7.0`                 |
| app-builder-lib          | 1       | 26.15.0                      | `26.18.0`               |

**Total: 100 alertas corrigidos.**

---

## Histórico dos alertas

Todos os alertas abaixo estão com status **✅ Corrigido** no Dependabot.

### electron (57 alertas)

Corrigidos ao subir o `electron` de `35.0.0` para `^45.3.0`.

| Alertas        | Versão corrigida | Status |
| -------------- | ---------------- | ------ |
| #90, #91       | 41.10.6          | ✅     |
| #92            | 41.10.4          | ✅     |
| #93            | 39.8.10          | ✅     |
| #111           | 42.11.3          | ✅     |
| #114           | 42.11.3          | ✅     |
| #115, #116     | 42.11.6          | ✅     |
| #117           | 42.11.1          | ✅     |
| #118           | 42.11.9          | ✅     |
| #119           | 42.11.3          | ✅     |
| #121           | 42.11.16         | ✅     |
| #132 – #139    | 38.8.6           | ✅     |
| #140           | 39.8.1           | ✅     |
| #141 – #145    | 38.8.6           | ✅     |
| #146 – #148    | 39.8.5           | ✅     |
| #157           | 39.8.8           | ✅     |
| #158           | 39.8.10          | ✅     |
| #159           | 39.8.7           | ✅     |
| #160           | 39.8.8           | ✅     |
| #161           | 39.8.9           | ✅     |
| #162           | 39.8.6           | ✅     |
| #163           | 39.8.8           | ✅     |
| #164           | 39.8.10          | ✅     |
| #165, #166     | 39.8.8           | ✅     |
| #167           | 39.8.10          | ✅     |
| #168           | 39.8.7           | ✅     |
| #169, #170     | 39.8.9           | ✅     |
| #171           | 39.8.8           | ✅     |
| #174 – #176    | 41.10.6          | ✅     |
| #177           | 41.10.4          | ✅     |
| #178           | 39.8.10          | ✅     |
| #179, #180     | 42.11.3          | ✅     |
| #181, #182     | 42.11.6          | ✅     |
| #183           | 42.11.1          | ✅     |
| #184           | 42.11.9          | ✅     |
| #185           | 42.11.3          | ✅     |
| #186           | 42.11.16         | ✅     |

### tar (12 alertas)

| Alertas   | Versão corrigida | Status |
| --------- | ---------------- | ------ |
| #126      | 7.5.3            | ✅     |
| #127      | 7.5.4            | ✅     |
| #128      | 7.5.7            | ✅     |
| #129      | 7.5.8            | ✅     |
| #130      | 7.5.10           | ✅     |
| #131      | 7.5.11           | ✅     |
| #149      | 7.5.16           | ✅     |
| #150      | 7.5.17           | ✅     |
| #151      | 7.5.18           | ✅     |
| #152      | 7.5.19           | ✅     |
| #153      | 7.5.18           | ✅     |
| #156      | 7.5.21           | ✅     |

### brace-expansion (9 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #94    | 5.0.10           | ✅     |
| #95    | 2.1.5            | ✅     |
| #96    | 1.1.19           | ✅     |
| #97    | 5.0.11           | ✅     |
| #98    | 2.1.6            | ✅     |
| #99    | 1.1.20           | ✅     |
| #100   | 5.0.12           | ✅     |
| #101   | 2.1.7            | ✅     |
| #102   | 1.1.21           | ✅     |

### vite (5 alertas)

| Alertas     | Versão corrigida | Status |
| ----------- | ---------------- | ------ |
| #106 – #110 | 6.4.4            | ✅     |

### ip-address (4 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #103   | 10.7.1           | ✅     |
| #104   | 10.7.1           | ✅     |
| #113   | 10.7.4           | ✅     |
| #189   | 10.7.4           | ✅     |

### minimatch (2 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #125   | 11.0.1           | ✅     |
| #188   | 11.0.1           | ✅     |

> O #188 era o último alerta em aberto. Só foi fechado depois de remover o `package-lock.json` — o Dependabot continuava lendo o lockfile antigo com minimatch vulnerável.

### glob (2 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #124   | 14.0.2           | ✅     |
| #187   | 14.0.2           | ✅     |

### extract-zip (2 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #172   | — (não existe)   | ✅     |
| #173   | — (não existe)   | ✅     |

> O `extract-zip` 2.0.1 é a última versão publicada no npm e não tem correção disponível. Os alertas foram fechados porque o pacote deixou de fazer parte da árvore de dependências com a migração para bun + overrides.

### systeminformation (2 alertas)

| Alerta | Versão corrigida | Status |
| ------ | ---------------- | ------ |
| #122   | 5.33.14          | ✅     |
| #123   | 5.33.16          | ✅     |

### Alertas individuais

| Pacote               | Alerta | Versão corrigida | Status |
| -------------------- | ------ | ---------------- | ------ |
| zod                  | #120   | 4.6.6            | ✅     |
| @vitest/mocker       | #112   | 4.1.12           | ✅     |
| source-map-js        | #105   | 1.2.2            | ✅     |
| builder-util-runtime | #155   | 9.7.0            | ✅     |
| app-builder-lib      | #154   | 26.15.0          | ✅     |

---

## Como corrigir os próximos alertas

O projeto usa **bun**. O ciclo é:

1. **Consulte os alertas abertos**:

   ```powershell
   $token = (Get-Content .env.local | Select-String '^GITHUB_TOKEN=').ToString().Split('=', 2)[1]
   Invoke-RestMethod -Uri "https://api.github.com/repos/FelipeMeloGomes/FM_Optimization/dependabot/alerts?state=open&per_page=100" -Headers @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json" }
   ```

2. **Atualize o `package.json`** (versão direta) ou adicione um **override** se o pacote for transitivo:

   ```json
   "overrides": {
     "pacote-vulneravel": "x.y.z"
   }
   ```

3. **Rode `bun install`** para regenerar o `bun.lock`.

4. **Confirme que a versão vulnerável saiu da árvore**:

   ```powershell
   npm audit
   ```

5. **Rode o gate de qualidade**:

   ```powershell
   bun run lint && bun run typecheck && bun run test
   ```

6. **Commit e push** para `main` e `beta`:

   ```powershell
   git add package.json bun.lock
   git commit -m "fix(deps): atualizar <pacote> para <versao>"
   git push origin beta
   git checkout main && git merge beta && git push origin main && git checkout beta
   ```

7. **Feche o PR automático do Dependabot**, se ele abrir um, explicando qual commit resolveu.

---

## Observações

- **Nunca recrie `package-lock.json` nem `pnpm-lock.yaml`.** Foi um lockfile npm desatualizado que manteve o alerta #188 aberto mesmo depois da correção. O lockfile oficial é o `bun.lock`.
- O `.github/dependabot.yml` está com `package-ecosystem: "pnpm"`. Como o projeto migrou para bun, vale revisar essa configuração: o ecossistema `bun` é suportado para **atualizações de versão**, mas o GitHub **não** oferece atualizações de segurança para ele.
- Os aliases `@minimatch/3.1.5`, `@minimatch/5.1.9`, `@minimatch/9.0.9` e `@minimatch/10.2.6` em `devDependencies` ficaram redundantes depois dos `overrides` e podem ser removidos numa limpeza futura.

---

**Última atualização:** 11/11/2026 — 0 alertas abertos, 100 corrigidos.
